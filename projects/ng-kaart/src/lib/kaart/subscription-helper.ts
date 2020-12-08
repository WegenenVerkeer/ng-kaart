import { either } from "fp-ts";
import { pipe } from "fp-ts/lib/pipeable";
import * as rx from "rxjs";
import { filter, take } from "rxjs/operators";

import { ofType } from "../util/operators";
import { TypedRecord } from "../util/typed-record";

import { KaartCmdDispatcher } from "./kaart-event-dispatcher";
import {
  KaartInternalMsg,
  KaartInternalSubMsg,
  SubscribedMsg,
  subscribedWrapper,
} from "./kaart-internal-messages";
import {
  KaartCmdValidation,
  SubscribeCmd,
  Subscription,
  SubscriptionResult,
  UnsubscribeCmd,
  ValidationWrapper,
} from "./kaart-protocol";

/**
 * Een Rx Operator die een observable van messages transformeert in een observable van de foutboodschappen die de kaart subscriptions
 * eventueel genereren. De belangrijkste functionaliteit is evenwel om ervoor te zorgen dat kaart subscriptions op het gepaste moment
 * vrijgegeven kunnen worden.
 *
 * De bedoeling is deze Operator te gebruiken in een ngOnInit en de Rx Subscription die er het resultaat van is te unsubscriben in de
 * bijhorende ngOnDestroy.
 *
 * Implementatie nota: MsgIn en MsgOut zijn potentieel verschillende types omdat de kaart component typisch een extra doet van interne
 * messages.
 *
 * @param dispatcher Een dispatcher voor MsgOut messages
 * @param msgGen Een functie die Wrapper voor SubscriptionResults genereert
 * @param subscriptions De subscriptions die naar de dispatcher gestuurd moeten worden
 */
export function subscriptionCmdOperator<
  MsgIn extends TypedRecord,
  MsgOut extends TypedRecord
>(
  dispatcher: KaartCmdDispatcher<MsgOut>,
  msgGen: (ref: any) => ValidationWrapper<SubscriptionResult, MsgOut>,
  ...subscriptions: Subscription<MsgOut>[]
): rx.Operator<MsgIn, string[]> {
  // We moeten de SubscriptionResults bijhouden om later te kunnen unsubscriben
  const subscriptionResults: SubscriptionResult[] = [];

  class InternalSubscriber extends rx.Subscriber<SubscribedMsg> {
    constructor(private readonly subscriber) {
      super(subscriber); // Dit is de reden dat we moeten afleiden: we mogen de subscription ketting niet breken
    }
    _next(msg: SubscribedMsg): void {
      pipe(
        msg.subscription,
        either.fold(
          (err) => this.subscriber.next(err), // De errors zenden we downstream
          (sub) => subscriptionResults.push(sub) // De SubscriptionResults houden we bij om later te unsubscriben
        )
      );
    }
    _complete(): void {
      // We doen hier helemaal niks. In het normale geval sturen we hier de completion van de source door naar
      // de subscriber. In dit geval willen we dit niet zodat de Observable "open" blijft totdat er expliciet
      // een unsubscribe gestuurd wordt en pas dan onze resources vrijgegeven worden (in dit geval UnsubscribeCmd sturen).
    }
  }

  return {
    call(
      subscriber: rx.Subscriber<string[]>,
      source: rx.Observable<MsgIn>
    ): rx.Subscription {
      // Ik durf this niet te gebruiken, maar een leeg record heeft de gewenste eigenschap dat het aan zichzelf gelijk is en niet aan
      // een ander leeg record
      const self = {};
      // De gevalideerde SubscriptionResults moeten gewrapped en geïdentificeerd worden
      const subscriptionWrapper = (v: KaartCmdValidation<SubscriptionResult>) =>
        msgGen(self)(v);
      // De subscriptions moeten elk in een SubscribeCmd gestoken worden dat op de bus gezet wordt
      subscriptions.forEach((subscription) =>
        dispatcher.dispatch(SubscribeCmd(subscription, subscriptionWrapper))
      );
      // We luisteren op de input observable naar messages van het type "Subscribed" en houden de geslaagde subscriptions bij
      // De errors sturen we uit
      const subscriptionsSubscription = source
        .pipe(
          ofType<SubscribedMsg>("Subscribed"), // We willen enkel de Subscribed messages
          filter((m) => m.reference === self), // en enkel die die we zelf de wereld ingestuurd hebben
          take(subscriptions.length) // als optimalisatie sluiten we de stream wanneer we evenveel resultaten als subscriptions hebben
        )
        .subscribe(new InternalSubscriber(subscriber));
      // We voegen extra TeardownLogic toe zodat we onze resources (de Kaart subscriptions) kunnen opkuisen
      subscriptionsSubscription.add(() => {
        // Stop de kaart subscriptions
        subscriptionResults.forEach((sub) =>
          dispatcher.dispatch(UnsubscribeCmd(sub))
        );
      });
      return subscriptionsSubscription;
    },
  };
}

/**
 * Een specialisatie van de subscriptionCmdOperator die specifiek werkt met KaartInternalMessages.
 */
export function internalMsgSubscriptionCmdOperator(
  dispatcher: KaartCmdDispatcher<KaartInternalMsg>,
  ...subscriptions: Subscription<KaartInternalMsg>[]
): rx.Operator<KaartInternalSubMsg, string[]> {
  return subscriptionCmdOperator(
    dispatcher,
    subscribedWrapper,
    ...subscriptions
  );
}
