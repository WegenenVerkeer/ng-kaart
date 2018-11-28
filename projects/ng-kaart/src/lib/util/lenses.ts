import { fromNullable } from "fp-ts/lib/Option";
import { Map } from "immutable";
import { Optional } from "monocle-ts";

/**
 * Een optional die waarde zoekt in een Map op basis van een key  waarbij er, in lijn met het Optional zijn, rekening mee
 * gehouden wordt dat de key niet noodzakelijk voorkomt. Een null waarde wordt als niet-voorkomend beschouwd.
 * @param key De key voor de map waarop we eventueel een waarde vinden.
 */
export const mapToOptionalByKey: <K, V>(key: K) => Optional<Map<K, V>, V> = key =>
  new Optional(
    map => fromNullable(map.get(key)), //
    value => map => map.set(key, value)
  );
