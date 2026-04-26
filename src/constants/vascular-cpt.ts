// SPDX-License-Identifier: Apache-2.0
/**
 * Vascular ultrasound CPT codes (hand-curated for angiology duplex reporting).
 *
 * 10 codes covering the full suite of vascular duplex procedures we ship.
 * Each code auto-populates by `studyType` when the user first loads the form,
 * but remains user-editable for labs whose billing preferences differ.
 *
 * Coding system for FHIR emission: `http://www.ama-assn.org/go/cpt`
 *
 * Source: AMA CPT 2024 Professional Edition.
 */

import type { Language } from '../contexts/TranslationContext';
import type { StudyType } from '../types/study';

export interface VascularCptEntry {
  readonly code: string;
  readonly display: {
    readonly ka: string;
    readonly en: string;
    readonly ru: string;
  };
}

export const CPT_SYSTEM = 'http://www.ama-assn.org/go/cpt' as const;

export const VASCULAR_CPT_CODES: ReadonlyArray<VascularCptEntry> = [
  {
    code: '93970',
    display: {
      ka: 'ორმხრივი ქვედა კიდურის ვენური დუპლექსი — სრული',
      en: 'Duplex scan of extremity veins, complete bilateral study',
      ru: 'Дуплексное сканирование вен конечностей, полное двустороннее',
    },
  },
  {
    code: '93971',
    display: {
      ka: 'ცალმხრივი ან შეზღუდული ქვედა კიდურის ვენური დუპლექსი',
      en: 'Duplex scan of extremity veins, unilateral or limited study',
      ru: 'Дуплексное сканирование вен конечностей, одностороннее или ограниченное',
    },
  },
  {
    code: '93965',
    display: {
      ka: 'არა-ინვაზიური ქვედა კიდურის ვენური კვლევა, სრული',
      en: 'Noninvasive physiologic study of extremity veins, complete bilateral',
      ru: 'Неинвазивное физиологическое исследование вен конечностей, полное',
    },
  },
  {
    code: '93925',
    display: {
      ka: 'ქვედა კიდურის არტერიული დუპლექსი — ორმხრივი',
      en: 'Duplex scan of lower extremity arteries, complete bilateral',
      ru: 'Дуплексное сканирование артерий нижних конечностей, двустороннее',
    },
  },
  {
    code: '93926',
    display: {
      ka: 'ქვედა კიდურის არტერიული დუპლექსი — ცალმხრივი ან შეზღუდული',
      en: 'Duplex scan of lower extremity arteries, unilateral or limited',
      ru: 'Дуплексное сканирование артерий нижних конечностей, одностороннее',
    },
  },
  {
    code: '93880',
    display: {
      ka: 'საძილე არტერიების დუპლექსი — ორმხრივი, სრული',
      en: 'Duplex scan of extracranial arteries, complete bilateral study',
      ru: 'Дуплексное сканирование экстракраниальных артерий, двустороннее',
    },
  },
  {
    code: '93882',
    display: {
      ka: 'საძილე არტერიების დუპლექსი — ცალმხრივი ან შეზღუდული',
      en: 'Duplex scan of extracranial arteries, unilateral or limited',
      ru: 'Дуплексное сканирование экстракраниальных артерий, одностороннее',
    },
  },
  {
    code: '93975',
    display: {
      ka: 'მუცლის, პელვისის ან რეტროპერიტონეული ორგანოების დუპლექსი, სრული',
      en: 'Duplex scan of arterial inflow and venous outflow of abdominal, pelvic, scrotal contents and/or retroperitoneal organs; complete study',
      ru: 'Дуплексное сканирование органов брюшной полости, таза и забрюшинного пространства, полное',
    },
  },
  {
    code: '93976',
    display: {
      ka: 'მუცლის ან პელვისის ორგანოების დუპლექსი, შეზღუდული',
      en: 'Duplex scan of arterial inflow and venous outflow of abdominal, pelvic, scrotal contents and/or retroperitoneal organs; limited study',
      ru: 'Дуплексное сканирование органов брюшной полости или таза, ограниченное',
    },
  },
  {
    code: '93990',
    display: {
      ka: 'დიალიზის ხელშემწყობი წვდომის (ფისტულის) დუპლექსი',
      en: 'Duplex scan of hemodialysis access',
      ru: 'Дуплексное сканирование гемодиализного доступа',
    },
  },
];

/**
 * Default CPT code per study type. Mapped by code (not array index) so that
 * reordering or inserting entries in `VASCULAR_CPT_CODES` cannot silently
 * shift a study to the wrong CPT — Wave 3.6 fix for Part 03 HIGH (the prior
 * implementation used `VASCULAR_CPT_CODES[N]!`, which is a brittle positional
 * coupling that produces wrong-billing on a future contributor's edit).
 *
 * Typed as `Readonly<Record<StudyType, string>>` so adding a new StudyType
 * fails at COMPILE time if the contributor forgets to map a default CPT.
 */
const STUDY_TO_CPT: Readonly<Record<StudyType, string>> = {
  venousLEBilateral: '93970',
  venousLERight: '93971',
  venousLELeft: '93971',
  arterialLE: '93925',
  carotid: '93880',
  ivcDuplex: '93975',
};

/**
 * The default CPT code for a given study type. Looked up by the form's
 * reducer when setting the initial StudyHeader.
 */
export function defaultCptForStudy(studyType: StudyType): VascularCptEntry {
  const code = STUDY_TO_CPT[studyType];
  const entry = VASCULAR_CPT_CODES.find((e) => e.code === code);
  if (!entry) {
    // Static guard — only triggers if `VASCULAR_CPT_CODES` is edited so a
    // mapped code disappears. Throwing rather than silently returning a wrong
    // entry surfaces the bug at the boundary instead of in a billed Claim.
    throw new Error(
      `defaultCptForStudy: VASCULAR_CPT_CODES is missing entry for code "${code}" (studyType="${studyType}")`
    );
  }
  return entry;
}

/**
 * Get the localized display string for a CPT entry.
 */
export function cptDisplay(entry: VascularCptEntry, lang: Language): string {
  return entry.display[lang] ?? entry.display.en;
}

/**
 * Find a CPT entry by code. Returns `undefined` if unknown.
 */
export function findCptByCode(code: string): VascularCptEntry | undefined {
  return VASCULAR_CPT_CODES.find((e) => e.code === code);
}
