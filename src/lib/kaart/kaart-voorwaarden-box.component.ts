import { Component, ElementRef, NgZone, OnInit, ViewChild } from "@angular/core";
import * as option from "fp-ts/lib/Option";

import { SchaalAangevraagdMsg, ToonCopyrightMsg, ToonVoorwaardenMsg } from "../kaart-classic/messages";
import { ofType } from "../util/operators";
import { KaartClassicComponent } from "./kaart-classic.component";
import { KaartComponentBase } from "./kaart-component-base";
import { kaartLogOnlyWrapper } from "./kaart-internal-messages";
import * as prt from "./kaart-protocol";

@Component({
  selector: "awv-kaart-voorwaarden-box",
  templateUrl: "./kaart-voorwaarden-box.html",
  styleUrls: ["./kaart-voorwaarden-box.scss"]
})
export class KaartVoorwaardenBoxComponent extends KaartComponentBase implements OnInit {
  @ViewChild("schaal") schaalElement: ElementRef;
  private copyright;
  private voorwaarden;
  private voorwaarden_href;

  constructor(readonly kaart: KaartClassicComponent, zone: NgZone) {
    super(zone);
  }

  ngOnInit(): void {
    super.ngOnInit();
    this.bindToLifeCycle(
      this.kaart.kaartClassicSubMsg$.pipe(ofType<SchaalAangevraagdMsg>("SchaalAangevraagd")) //
    ).subscribe(msg =>
      this.kaart.dispatch(prt.VoegSchaalToeCmd(option.fromNullable(this.schaalElement.nativeElement), kaartLogOnlyWrapper))
    );
    this.bindToLifeCycle(
      this.kaart.kaartClassicSubMsg$.pipe(ofType<ToonVoorwaardenMsg>("ToonVoorwaarden")) //
    ).subscribe(msg => {
      this.voorwaarden = msg.titel;
      this.voorwaarden_href = msg.href;
    });
    this.bindToLifeCycle(
      this.kaart.kaartClassicSubMsg$.pipe(ofType<ToonCopyrightMsg>("ToonCopyright")) //
    ).subscribe(msg => {
      this.copyright = msg.copyright;
    });
  }
}
