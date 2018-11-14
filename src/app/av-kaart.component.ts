import { Component, OnInit, ViewEncapsulation } from "@angular/core";

@Component({
  selector: "awv-av-kaart",
  templateUrl: "./av-kaart.component.html"
  // encapsulation: ViewEncapsulation.None
})
export class AvKaartComponent implements OnInit {
  adressen = [];
  percelen = [];
  weglocaties = [];

  ngOnInit(): void {
    const toevoegenPerceel = () => {
      this.percelen = [
        {
          id: 68779,
          versie: 1,
          capakey: "24592D0028/00C003",
          gemeenteCode: "24107",
          afdelingCode: "24592",
          afdelingNaam: "TIENEN  2 AFD",
          sectieCode: "D",
          perceelnummer: "0028/00C003",
          geometrie:
            "POLYGON((191733.37900000066 165703.13699999824,191674.8069999963 165712.26399999857," +
            "191664.19200000167 165651.2109999992,191661.98200000077 165638.50499999896," +
            "191654.44409999996 165630.27589999884,191706.23099999875 165617.17599999905," +
            "191720.43500000238 165628.2969999984,191723.0549999997 165643.45199999958," +
            "191729.22399999946 165679.13599999994,191733.37900000066 165703.13699999824))"
        }
      ];
    };
    const toevoegenLocatie = () => {
      this.weglocaties = [
        {
          id: 96225,
          versie: 5,
          lijnLocatie: {
            ident8: "N0030001",
            beginHm: 45.7,
            eindHm: 45.8,
            afstandBeginHm: 56,
            afstandEindHm: 12,
            zijdeRijbaan: "RECHTS"
          },
          wegType: "GEWESTWEG",
          valid: true,
          geometrie:
            "LINESTRING (191669.82642390765 165718.64955434913, 191671.5169999972 165718.39400000125," +
            "191696.28400000185 165714.71499999985, 191712.1700000018 165713.4690000005, 191735.49737736158 165710.32842767247)"
        }
      ];
      setTimeout(toevoegenPerceel, 1000);
    };

    const toevoegenAdres = () => {
      this.adressen = [
        {
          id: 97285,
          versie: 1,
          straat: "Sint-Truidensesteenweg",
          nummer: "119",
          postcode: "3300",
          plaatsnaam: "Tienen",
          land: "BE",
          geometrie: "POINT(191698.77 165662.99)",
          geometrieStatus: "OPGEHAALD",
          adresRegel1: "Sint-Truidensesteenweg 119",
          adresRegel2: "3300 Tienen"
        }
      ];
      setTimeout(toevoegenLocatie, 1000);
    };

    setTimeout(toevoegenAdres, 1000);
  }
}
