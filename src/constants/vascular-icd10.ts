// SPDX-License-Identifier: Apache-2.0
/**
 * Vascular-relevant ICD-10-CM codes (hand-curated for angiology duplex reporting).
 *
 * ~30 codes covering the most common indications for a lower-extremity venous duplex:
 *   - I80.x  Phlebitis / thrombophlebitis
 *   - I82.x  Other venous embolism / thrombosis
 *   - I83.x  Varicose veins (with/without complications)
 *   - I87.x  Venous insufficiency, post-thrombotic syndrome
 *   - Z86.x  Personal history of venous thromboembolism
 *   - Plus an "other" escape hatch for free-text indications.
 *
 * Each code carries display strings in Georgian (primary), English (canonical),
 * and Russian. All wording verified against ICD-10-CM 2024 and clinical
 * angiology usage.
 *
 * Coding system for FHIR emission: `http://hl7.org/fhir/sid/icd-10`
 */

import type { Language } from '../contexts/TranslationContext';

export interface VascularIcd10Entry {
  readonly code: string;
  readonly display: {
    readonly ka: string;
    readonly en: string;
    readonly ru: string;
  };
}

export const ICD10_SYSTEM = 'http://hl7.org/fhir/sid/icd-10' as const;

export const VASCULAR_ICD10_CODES: ReadonlyArray<VascularIcd10Entry> = [
  // --- I80 — Phlebitis and thrombophlebitis -------------------------------
  {
    code: 'I80.1',
    display: {
      ka: 'ფლებიტი და თრომბოფლებიტი თეძო-ბარძაყის ვენისა',
      en: 'Phlebitis and thrombophlebitis of femoral vein',
      ru: 'Флебит и тромбофлебит бедренной вены',
    },
  },
  {
    code: 'I80.211',
    display: {
      ka: 'ფლებიტი და თრომბოფლებიტი მარჯვენა თეძოს ვენისა',
      en: 'Phlebitis and thrombophlebitis of right iliac vein',
      ru: 'Флебит и тромбофлебит правой подвздошной вены',
    },
  },
  {
    code: 'I80.221',
    display: {
      ka: 'ფლებიტი და თრომბოფლებიტი მარჯვენა მუხლქვეშა ვენისა',
      en: 'Phlebitis and thrombophlebitis of right popliteal vein',
      ru: 'Флебит и тромбофлебит правой подколенной вены',
    },
  },
  {
    code: 'I80.222',
    display: {
      ka: 'ფლებიტი და თრომბოფლებიტი მარცხენა მუხლქვეშა ვენისა',
      en: 'Phlebitis and thrombophlebitis of left popliteal vein',
      ru: 'Флебит и тромбофлебит левой подколенной вены',
    },
  },
  {
    code: 'I80.23',
    display: {
      ka: 'ფლებიტი და თრომბოფლებიტი წვივის ვენისა',
      en: 'Phlebitis and thrombophlebitis of tibial vein',
      ru: 'Флебит и тромбофлебит большеберцовой вены',
    },
  },
  {
    code: 'I80.29',
    display: {
      ka: 'ქვედა კიდურის სხვა ღრმა ვენის ფლებიტი',
      en: 'Phlebitis and thrombophlebitis of other deep vessels of lower extremities',
      ru: 'Флебит и тромбофлебит других глубоких сосудов нижних конечностей',
    },
  },
  {
    code: 'I80.3',
    display: {
      ka: 'ქვედა კიდურის ფლებიტი, დაუზუსტებელი',
      en: 'Phlebitis and thrombophlebitis of lower extremities, unspecified',
      ru: 'Флебит и тромбофлебит нижних конечностей неуточнённый',
    },
  },

  // --- I82 — Other venous embolism and thrombosis -------------------------
  {
    code: 'I82.401',
    display: {
      ka: 'მწვავე ემბოლია/თრომბოზი მარჯვენა ფემორალური ვენისა',
      en: 'Acute embolism and thrombosis of right femoral vein',
      ru: 'Острая эмболия и тромбоз правой бедренной вены',
    },
  },
  {
    code: 'I82.402',
    display: {
      ka: 'მწვავე ემბოლია/თრომბოზი მარცხენა ფემორალური ვენისა',
      en: 'Acute embolism and thrombosis of left femoral vein',
      ru: 'Острая эмболия и тромбоз левой бедренной вены',
    },
  },
  {
    code: 'I82.411',
    display: {
      ka: 'მწვავე ემბოლია/თრომბოზი მარჯვენა თეძოს ვენისა',
      en: 'Acute embolism and thrombosis of right iliac vein',
      ru: 'Острая эмболия и тромбоз правой подвздошной вены',
    },
  },
  {
    code: 'I82.421',
    display: {
      ka: 'მწვავე ემბოლია/თრომბოზი მარჯვენა მუხლქვეშა ვენისა',
      en: 'Acute embolism and thrombosis of right popliteal vein',
      ru: 'Острая эмболия и тромбоз правой подколенной вены',
    },
  },
  {
    code: 'I82.422',
    display: {
      ka: 'მწვავე ემბოლია/თრომბოზი მარცხენა მუხლქვეშა ვენისა',
      en: 'Acute embolism and thrombosis of left popliteal vein',
      ru: 'Острая эмболия и тромбоз левой подколенной вены',
    },
  },
  {
    code: 'I82.441',
    display: {
      ka: 'მწვავე ემბოლია/თრომბოზი მარჯვენა წვივის ვენისა',
      en: 'Acute embolism and thrombosis of right tibial vein',
      ru: 'Острая эмболия и тромбоз правой большеберцовой вены',
    },
  },
  {
    code: 'I82.4Y1',
    display: {
      ka: 'მწვავე ემბოლია/თრომბოზი მარჯვენა ქვედა კიდურის ღრმა ვენისა',
      en: 'Acute embolism and thrombosis of unspecified deep veins of right lower extremity',
      ru: 'Острая эмболия и тромбоз глубоких вен правой нижней конечности',
    },
  },
  {
    code: 'I82.4Y2',
    display: {
      ka: 'მწვავე ემბოლია/თრომბოზი მარცხენა ქვედა კიდურის ღრმა ვენისა',
      en: 'Acute embolism and thrombosis of unspecified deep veins of left lower extremity',
      ru: 'Острая эмболия и тромбоз глубоких вен левой нижней конечности',
    },
  },
  {
    code: 'I82.5Y1',
    display: {
      ka: 'ქრონიკული ემბოლია/თრომბოზი მარჯვენა ქვედა კიდურის ღრმა ვენისა',
      en: 'Chronic embolism and thrombosis of unspecified deep veins of right lower extremity',
      ru: 'Хроническая эмболия и тромбоз глубоких вен правой нижней конечности',
    },
  },
  {
    code: 'I82.819',
    display: {
      ka: 'მწვავე ზედაპირული ვენის ემბოლია/თრომბოზი, მხარე დაუზუსტებელი',
      en: 'Embolism and thrombosis of superficial veins of unspecified lower extremity',
      ru: 'Эмболия и тромбоз поверхностных вен нижней конечности неуточнённый',
    },
  },

  // --- I83 — Varicose veins ------------------------------------------------
  {
    code: 'I83.0',
    display: {
      ka: 'ქვედა კიდურის ვარიკოზული ვენები წყლულის გამოვლინებით',
      en: 'Varicose veins of lower extremities with ulcer',
      ru: 'Варикозное расширение вен нижних конечностей с язвой',
    },
  },
  {
    code: 'I83.1',
    display: {
      ka: 'ქვედა კიდურის ვარიკოზული ვენები ანთების გამოვლინებით',
      en: 'Varicose veins of lower extremities with inflammation',
      ru: 'Варикозное расширение вен нижних конечностей с воспалением',
    },
  },
  {
    code: 'I83.2',
    display: {
      ka: 'ქვედა კიდურის ვარიკოზული ვენები წყლულისა და ანთების გამოვლინებით',
      en: 'Varicose veins of lower extremities with both ulcer and inflammation',
      ru: 'Варикозное расширение вен нижних конечностей с язвой и воспалением',
    },
  },
  {
    code: 'I83.90',
    display: {
      ka: 'უსიმპტომო ვარიკოზული ვენები ქვედა კიდურებისა',
      en: 'Asymptomatic varicose veins of lower extremities',
      ru: 'Бессимптомное варикозное расширение вен нижних конечностей',
    },
  },
  {
    code: 'I83.91',
    display: {
      ka: 'სიმპტომური ვარიკოზული ვენები ქვედა კიდურებისა',
      en: 'Symptomatic varicose veins of lower extremities',
      ru: 'Симптоматическое варикозное расширение вен нижних конечностей',
    },
  },

  // --- I87 — Other venous disorders ---------------------------------------
  {
    code: 'I87.011',
    display: {
      ka: 'პოსტთრომბული სინდრომი, მარჯვენა ქვედა კიდური',
      en: 'Postthrombotic syndrome with ulcer of right lower extremity',
      ru: 'Посттромбофлебитический синдром правой нижней конечности с язвой',
    },
  },
  {
    code: 'I87.2',
    display: {
      ka: 'ქრონიკული ვენური უკმარისობა (პერიფერიული)',
      en: 'Venous insufficiency (chronic) (peripheral)',
      ru: 'Венозная недостаточность (хроническая) (периферическая)',
    },
  },
  {
    code: 'I87.33',
    display: {
      ka: 'ქრონიკული ვენური ჰიპერტენზია ორივე ქვედა კიდურის წყლულთან',
      en: 'Chronic venous hypertension with ulcer of bilateral lower extremity',
      ru: 'Хроническая венозная гипертензия с язвой обеих нижних конечностей',
    },
  },

  // --- Z86 — Personal history ---------------------------------------------
  {
    code: 'Z86.718',
    display: {
      ka: 'პირადი ისტორია: ვენური თრომბოზი და ემბოლია',
      en: 'Personal history of other venous thrombosis and embolism',
      ru: 'В анамнезе: венозный тромбоз и эмболия',
    },
  },
  {
    code: 'Z86.711',
    display: {
      ka: 'პირადი ისტორია: ფილტვის ემბოლია',
      en: 'Personal history of pulmonary embolism',
      ru: 'В анамнезе: эмболия лёгочной артерии',
    },
  },

  // --- R22 / M79 — Related findings ---------------------------------------
  {
    code: 'R22.43',
    display: {
      ka: 'ლოკალიზებული შეშუპება ქვედა კიდურზე, ორმხრივი',
      en: 'Localized swelling, mass and lump, lower limb, bilateral',
      ru: 'Локализованный отёк, масса и уплотнение нижней конечности, двусторонние',
    },
  },
  {
    code: 'M79.604',
    display: {
      ka: 'ტკივილი მარჯვენა ფეხში',
      en: 'Pain in right leg',
      ru: 'Боль в правой ноге',
    },
  },
  {
    code: 'M79.605',
    display: {
      ka: 'ტკივილი მარცხენა ფეხში',
      en: 'Pain in left leg',
      ru: 'Боль в левой ноге',
    },
  },

  // --- Escape hatch -------------------------------------------------------
  {
    code: 'OTHER',
    display: {
      ka: 'სხვა (შეიყვანეთ თავისუფალი ტექსტი)',
      en: 'Other (free-text indication)',
      ru: 'Другое (введите текст)',
    },
  },
];

/**
 * Get the localized display string for an ICD-10 entry.
 */
export function icd10Display(entry: VascularIcd10Entry, lang: Language): string {
  return entry.display[lang] ?? entry.display.en;
}

/**
 * Find an ICD-10 entry by code. Returns `undefined` if unknown.
 */
export function findIcd10ByCode(code: string): VascularIcd10Entry | undefined {
  return VASCULAR_ICD10_CODES.find((e) => e.code === code);
}
