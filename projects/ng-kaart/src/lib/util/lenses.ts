import { fromNullable, Option } from "fp-ts/lib/Option";
import { Lens, Optional } from "monocle-ts";

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

// We willen van de Map van immutable af. Daarom ook al operaties op native maps.
// Vaak zijn de toeters en bellen van fp-ts StrMap niet nodig.

export interface StringMapped<V> {
  readonly [key: string]: V;
}

export interface NumberMapped<V> {
  readonly [key: number]: V;
}

export const numberMapOptional: <V>(k: number) => Optional<NumberMapped<V>, V> = k =>
  new Optional(
    map => fromNullable(map[k]),
    v => map => {
      const cloned = { ...map }; // een ondiepe clone is goed genoeg als V immutable is
      cloned[k] = v;
      return cloned;
    }
  );

export const removeFromNumberMap: <V>(k: number) => (_: NumberMapped<V>) => NumberMapped<V> = k => map => {
  const cloned = { ...map }; // een ondiepe clone is goed genoeg als V immutable is
  delete cloned[k];
  return cloned;
};

export const numberMapLens: <V>(k: number) => Lens<NumberMapped<V>, Option<V>> = k =>
  new Lens(
    map => fromNullable(map[k]),
    mv => map => {
      const cloned = { ...map }; // een ondiepe clone is goed genoeg als V immutable is
      mv.foldL(
        () => delete cloned[k],
        v => {
          cloned[k] = v;
          return true;
        }
      );
      return cloned;
    }
  );

// Ik geloof dat er wel wat mogelijk is met type wizardry om deze 2 functies in 1 te draaien
export const stringMapOptional: <V>(k: string) => Optional<StringMapped<V>, V> = k =>
  new Optional(
    map => fromNullable(map[k]),
    v => map => {
      const cloned = { ...map }; // een ondiepe clone is goed genoeg als V immutable is
      cloned[k] = v;
      return cloned;
    }
  );

export const removeFromStringMap: <V>(k: string) => (_: StringMapped<V>) => StringMapped<V> = k => map => {
  const cloned = { ...map }; // een ondiepe clone is goed genoeg als V immutable is
  delete cloned[k];
  return cloned;
};

export const stringMapLens: <V>(k: string) => Lens<StringMapped<V>, Option<V>> = k =>
  new Lens(
    map => fromNullable(map[k]),
    mv => map => {
      const cloned = { ...map }; // een ondiepe clone is goed genoeg als V immutable is
      mv.foldL(
        () => delete cloned[k],
        v => {
          cloned[k] = v;
          return true;
        }
      );
      return cloned;
    }
  );
