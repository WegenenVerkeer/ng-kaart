export const Onbeschikbaar = "Onbeschikbaar";
export type Onbeschikbaar = typeof Onbeschikbaar;
export const Opengeklapt = "Opengeklapt";
export type Opengeklapt = typeof Opengeklapt;
export const Dichtgeklapt = "Dichtgeklapt";
export type Dichtgeklapt = typeof Dichtgeklapt;
export const Sluimerend = "Sluimerend";
export type Sluimerend = typeof Sluimerend;
export type TabelActiviteit =
  | Onbeschikbaar
  | Opengeklapt
  | Dichtgeklapt
  | Sluimerend;
