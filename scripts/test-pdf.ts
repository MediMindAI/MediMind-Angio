/**
 * scripts/test-pdf.ts
 *
 * Generates a full Phase 1 Venous LE bilateral sample report to
 * `/tmp/sample-report.pdf` so a reviewer can confirm the PDF pipeline
 * renders correctly end-to-end:
 *   · Noto Sans Georgian loaded (Georgian glyphs render, not boxes)
 *   · Anatomy SVGs parsed + colored per competency
 *   · Per-segment findings table populates
 *   · Page 2 narrative + CEAP + recommendations render
 *   · Footer appears on every page
 *
 * Usage: `npx tsx scripts/test-pdf.ts`
 *
 * The script writes to /tmp/sample-report.pdf and does NOT rely on the
 * browser — it calls react-pdf's `renderToBuffer` directly, reading
 * anatomy SVGs from disk via node:fs.
 */

import { createElement } from 'react';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { renderToBuffer, Font } from '@react-pdf/renderer';

import ReportDocument from '../src/components/pdf/ReportDocument';
import type { ReportLabels } from '../src/components/pdf/ReportDocument';
import { loadAnatomyForPdf } from '../src/components/pdf/anatomyToPdfSvg';
import type { FormState } from '../src/types/form';
import type {
  VenousLESegmentBase,
  VenousSegmentFindings,
} from '../src/components/studies/venous-le/config';

async function registerFonts(): Promise<void> {
  // In Node, @react-pdf/font accepts absolute file paths for `src`.
  const fontsDir = resolve(process.cwd(), 'public', 'fonts');
  Font.register({
    family: 'NotoSansGeorgian',
    fonts: [
      { src: resolve(fontsDir, 'NotoSansGeorgian-Regular.ttf'), fontWeight: 'normal' },
      { src: resolve(fontsDir, 'NotoSansGeorgian-Bold.ttf'), fontWeight: 'bold' },
    ],
  });
}

// ---------------------------------------------------------------------------
// Mock form — mix of normal / incompetent / inconclusive / ablated segments
// ---------------------------------------------------------------------------

const mockForm: FormState = {
  studyType: 'venousLEBilateral',
  header: {
    patientName: 'ნინო გელაშვილი (Nino Gelashvili)',
    patientId: 'MRN-00123',
    patientBirthDate: '1971-05-14',
    patientGender: 'female',
    studyDate: '2026-04-23',
    operatorName: 'Dr. Elene Kvinikadze',
    referringPhysician: 'Dr. Giorgi Beridze',
    institution: 'MediMind Angio Center',
    accessionNumber: 'ACC-20260423-004',
    // Phase 1.5 additions
    informedConsent: true,
    informedConsentSignedAt: '2026-04-23',
    patientPosition: 'reverse-trendelenburg-30',
    medications: 'Apixaban 5 mg BID (last dose 08:00); Atorvastatin 20 mg OD.',
    icd10Codes: [
      { code: 'I83.91', display: 'Symptomatic varicose veins of lower extremities' },
      { code: 'I87.2', display: 'Venous insufficiency (chronic) (peripheral)' },
    ],
    cptCode: {
      code: '93970',
      display: 'Duplex scan of extremity veins, complete bilateral study',
    },
  },
  segments: [
    // RIGHT side
    {
      segmentId: 'cfv',
      side: 'right',
      competency: 'normal',
      refluxDurationMs: 420,
      diameterMm: 10.5,
    },
    {
      segmentId: 'fv-prox',
      side: 'right',
      competency: 'normal',
      refluxDurationMs: 380,
      diameterMm: 7.1,
    },
    {
      segmentId: 'pop-ak',
      side: 'right',
      competency: 'normal',
      refluxDurationMs: 250,
      diameterMm: 6.2,
    },
    {
      segmentId: 'gsv-ak',
      side: 'right',
      competency: 'incompetent',
      refluxDurationMs: 3210,
      diameterMm: 6.6,
    },
    {
      segmentId: 'gsv-prox-calf',
      side: 'right',
      competency: 'incompetent',
      refluxDurationMs: 2510,
      diameterMm: 5.4,
    },
    {
      segmentId: 'gsv-mid-calf',
      side: 'right',
      competency: 'inconclusive',
      diameterMm: 4.1,
    },
    {
      segmentId: 'ssv',
      side: 'right',
      competency: 'ablated',
      refluxDurationMs: 0,
      diameterMm: 3.2,
    },
    // LEFT side
    {
      segmentId: 'cfv',
      side: 'left',
      competency: 'normal',
      refluxDurationMs: 1466,
      diameterMm: 11.2,
    },
    {
      segmentId: 'fv-prox',
      side: 'left',
      competency: 'normal',
      refluxDurationMs: 410,
      diameterMm: 7.0,
    },
    {
      segmentId: 'pop-ak',
      side: 'left',
      competency: 'normal',
      refluxDurationMs: 290,
      diameterMm: 6.4,
    },
    {
      segmentId: 'gsv-ak',
      side: 'left',
      competency: 'incompetent',
      refluxDurationMs: 2800,
      diameterMm: 5.9,
    },
    {
      segmentId: 'gsv-prox-calf',
      side: 'left',
      competency: 'normal',
      refluxDurationMs: 410,
      diameterMm: 4.8,
    },
    {
      segmentId: 'ssv',
      side: 'left',
      competency: 'incompetent',
      refluxDurationMs: 1800,
      diameterMm: 4.2,
    },
  ],
  narrative: {
    indication: 'Bilateral lower-extremity aching, visible varicose veins along medial thigh.',
    technique:
      'Bilateral lower-extremity duplex ultrasound performed with both standing and supine positioning. B-mode, color Doppler, and augmentation maneuvers per IAC/SVU protocol.',
    findings: '',
    impression:
      'Bilateral great saphenous vein incompetence with reflux extending to the proximal calf on the right. Small saphenous vein incompetence on the left. Deep venous system shows no evidence of DVT, with preserved compressibility and phasicity throughout.',
    comments: 'Patient asked about sclerotherapy options — referred to phlebology follow-up.',
    sonographerComments:
      'Limited compressibility assessment at GSV mid-calf due to patient tolerance; positioning reverted to seated after 10 min.',
    clinicianComments:
      'Findings correlate with CEAP C2s. Recommend outpatient endovenous ablation consult for bilateral GSV.',
  },
  ceap: {
    c: 'C2',
    e: 'Ep',
    a: 'As',
    p: 'Pr',
    modifiers: ['s'],
  },
  recommendations: [
    {
      id: 'rec-1',
      text: 'Compression therapy (20–30 mmHg knee-length stockings) bilaterally.',
      priority: 'routine',
      followUpInterval: '3 months',
    },
    {
      id: 'rec-2',
      text: 'Referral to phlebology for consideration of endovenous ablation of right GSV.',
      priority: 'urgent',
    },
    {
      id: 'rec-3',
      text: 'Follow-up duplex ultrasound in 6 months to reassess.',
      priority: 'routine',
      followUpInterval: '6 months',
    },
  ],
  parameters: {
    'depth-gsv-ak-right': 6.6,
    'depth-gsv-prox-calf-right': 5.1,
    'depth-gsv-ak-left': 5.8,
    'depth-ssv-left': 4.2,
    'trans-gsv-ak-right': 5.9,
    'trans-gsv-prox-calf-right': 4.6,
    'trans-gsv-ak-left': 5.3,
    'trans-ssv-left': 3.8,
    'trans-cfv-right': 9.8,
    'trans-cfv-left': 10.5,
  },
};

// ---------------------------------------------------------------------------
// Label bundle — English for the smoke test
// ---------------------------------------------------------------------------

const labels: ReportLabels = {
  title: 'Bilateral Reflux Venous Lower Extremity Study Report',
  subtitle: 'Duplex Ultrasound — IAC/SVU Protocol',
  issueDateLabel: 'Issued',
  preliminary: 'PRELIMINARY',
  patient: {
    patientName: 'Patient',
    mrn: 'MRN',
    dob: 'DOB',
    age: 'Age',
    gender: 'Sex',
    studyDate: 'Study Date',
    operator: 'Sonographer',
    referring: 'Referring Physician',
    institution: 'Institution',
    accession: 'Accession',
    patientPosition: 'Position',
    medications: 'Medications',
    icd10Codes: 'ICD-10',
    informedConsent: 'Informed consent',
    informedConsentYes: 'Yes',
    informedConsentNo: 'No',
    positionLabels: {
      supine: 'Supine',
      'reverse-trendelenburg-30': 'Reverse Trendelenburg 30°',
      standing: 'Standing',
      seated: 'Seated',
      'side-lying': 'Side-lying',
    },
  },
  diagram: {
    anterior: 'Anterior',
    posterior: 'Posterior',
    legendLabel: 'Competency legend',
    legend: {
      normal: 'Normal',
      occluded: 'Occlusion',
      incompetent: 'Incompetent',
      inconclusive: 'Inconclusive',
      ablated: 'Ablated',
    },
  },
  findings: {
    right: 'RIGHT',
    left: 'LEFT',
    segment: 'Segment',
    refluxMs: 'Reflux (cm/s)',
    apMm: 'Diameter (mm)',
    depthMm: 'Depth (mm)',
    segmentName: {
      cfv: 'Common femoral v.',
      'fv-prox': 'Femoral v. (prox.)',
      'fv-mid': 'Femoral v. (mid)',
      'fv-dist': 'Femoral v. (dist.)',
      pfv: 'Profunda v.',
      'gsv-prox-thigh': 'GSV (prox. thigh)',
      'gsv-mid-thigh': 'GSV (mid thigh)',
      'gsv-dist-thigh': 'GSV (dist. thigh)',
      'gsv-knee': 'GSV (knee)',
      'gsv-calf': 'GSV (calf)',
      'pop-ak': 'Popliteal (above knee)',
      'pop-bk': 'Popliteal (below knee)',
      ptv: 'Posterior tibial v.',
      per: 'Peroneal v.',
      ssv: 'Small saphenous v.',
      gastroc: 'Gastrocnemius v.',
      soleal: 'Soleal v.',
      sfj: 'Saphenofemoral jct.',
      spj: 'Saphenopopliteal jct.',
    } as Record<VenousLESegmentBase, string>,
    emptyDash: '—',
  },
  arterialFindings: {
    right: 'Right',
    left: 'Left',
    segment: 'Segment',
    waveform: 'Waveform',
    psv: 'PSV',
    stenosis: 'Stenosis',
    plaque: 'Plaque',
    occluded: 'Occl.',
    occludedMark: '✓',
    segmentName: {
      cia: 'Common iliac a.',
      eia: 'External iliac a.',
      cfa: 'Common femoral a.',
      pfa: 'Profunda femoris a.',
      'sfa-prox': 'SFA (prox.)',
      'sfa-mid': 'SFA (mid)',
      'sfa-dist': 'SFA (dist.)',
      'pop-ak': 'Popliteal (AK)',
      'pop-bk': 'Popliteal (BK)',
      tpt: 'Tibioperoneal tr.',
      ata: 'Anterior tibial a.',
      pta: 'Posterior tibial a.',
      per: 'Peroneal a.',
      dp: 'Dorsalis pedis a.',
    },
    waveformName: {
      triphasic: 'Triphasic',
      biphasic: 'Biphasic',
      'monophasic-phasic': 'Monophasic (phasic)',
      'monophasic-damped': 'Monophasic (damped)',
      absent: 'Absent',
    },
    stenosisName: {
      none: '< 30 %',
      mild: '30–49 %',
      moderate: '50–69 %',
      severe: '70–99 %',
      occluded: 'Occluded',
    },
    plaqueName: {
      none: 'None',
      calcified: 'Calcified',
      mixed: 'Mixed',
      soft: 'Soft',
    },
    emptyDash: '—',
  },
  pressures: {
    title: 'Segmental pressures (mmHg)',
    sideRight: 'R',
    sideLeft: 'L',
    brachial: 'Brachial',
    highThigh: 'High thigh',
    lowThigh: 'Low thigh',
    calf: 'Calf',
    ankleDp: 'Ankle DP',
    anklePt: 'Ankle PT',
    toe: 'Toe',
    abi: 'ABI',
    tbi: 'TBI',
    abiBand: {
      'non-compressible': 'Non-compressible',
      normal: 'Normal',
      mild: 'Mild',
      moderate: 'Moderate',
      severe: 'Severe',
      unknown: 'Unknown',
    },
    emptyDash: '—',
  },
  carotidFindings: {
    right: 'Right',
    left: 'Left',
    vessel: 'Vessel',
    psv: 'PSV',
    edv: 'EDV',
    flow: 'Flow',
    plaque: 'Plaque',
    ratio: 'ICA/CCA',
    ulcerationMark: '⚠',
    vesselName: {
      'cca-prox': 'CCA (prox.)',
      'cca-mid': 'CCA (mid)',
      'cca-dist': 'CCA (dist.)',
      bulb: 'Carotid bulb',
      'ica-prox': 'ICA (prox.)',
      'ica-mid': 'ICA (mid)',
      'ica-dist': 'ICA (dist.)',
      eca: 'ECA',
      'vert-v1': 'Vertebral V1',
      'vert-v2': 'Vertebral V2',
      'vert-v3': 'Vertebral V3',
      'subclav-prox': 'Subclavian (prox.)',
      'subclav-dist': 'Subclavian (dist.)',
    },
    flowName: {
      antegrade: 'Antegrade',
      retrograde: 'Retrograde',
      bidirectional: 'Bidirectional',
      absent: 'Absent',
    },
    plaqueName: {
      none: 'None',
      calcified: 'Calcified',
      mixed: 'Mixed',
      soft: 'Soft',
    },
    surfaceName: {
      smooth: 'Smooth',
      irregular: 'Irregular',
    },
    emptyDash: '—',
  },
  nascet: {
    title: 'NASCET classification',
    rightIca: 'Right ICA',
    leftIca: 'Left ICA',
    categoryName: {
      lt50: '< 50 %',
      '50to69': '50–69 %',
      ge70: '≥ 70 %',
      'near-occlusion': 'Near-occlusion',
      occluded: 'Occluded',
    },
    noneLabel: '—',
  },
  narrative: {
    rightFindings: 'Right-side Findings',
    leftFindings: 'Left-side Findings',
    indication: 'Indication',
    technique: 'Technique',
    findings: 'Findings',
    impression: 'Impression',
    comments: 'Comments',
    conclusions: 'Conclusions',
    sonographerComments: 'Sonographer Comments',
    clinicianComments: 'Clinician Impression',
  },
  ceap: {
    heading: 'CEAP Classification (2020)',
    cAxis: 'Clinical: Varicose veins, symptomatic',
    eAxis: 'Etiology: Primary',
    aAxis: 'Anatomy: Superficial',
    pAxis: 'Pathophysiology: Reflux',
  },
  recommendations: {
    heading: 'Recommendations',
    priority: {
      routine: 'Routine',
      urgent: 'Urgent',
      stat: 'Stat',
    },
    followUpPrefix: 'Follow-up:',
  },
  footer: {
    pageLabelTemplate: 'Page {current} of {total}',
  },
};

// Optional per-side generated prose — Phase 1 keeps the prose generator in a
// sibling task; supply static strings here for the smoke test so the layout
// exercises that code path.
const rightFindings =
  'Right leg: Deep venous system shows preserved compressibility in CFV, FV, and popliteal veins. No DVT. Great saphenous vein is markedly incompetent with 3.2 s of reflux at the SFJ extending to the proximal calf. Small saphenous vein was previously ablated and shows no flow.';
const leftFindings =
  'Left leg: Deep venous system shows preserved compressibility throughout; CFV exhibits physiological reflux (1.47 s) below the threshold for deep-vein insufficiency. GSV incompetence from the SFJ (2.8 s) with reflux to mid-thigh. SSV is incompetent in the upper calf.';

const conclusions: ReadonlyArray<string> = [
  'Bilateral primary superficial venous insufficiency (right GSV, left GSV and SSV).',
  'No evidence of deep venous thrombosis or obstruction bilaterally.',
  'Clinical CEAP C2s — symptomatic varicose veins.',
];

const org = {
  name: 'MediMind Angio Center',
  address: 'Tbilisi, Georgia · +995 32 000 000',
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  await registerFonts();

  // Use the derived-competency helper to drive diagram colors so the anatomy
  // reflects the actual findings (same code path the form uses).
  const mutableFindings: Record<
    string,
    {
      refluxDurationMs?: number;
      apDiameterMm?: number;
      transDiameterMm?: number;
      depthMm?: number;
      compressibility?: 'non-compressible' | 'inconclusive';
    }
  > = {};
  for (const seg of mockForm.segments) {
    if (seg.side !== 'left' && seg.side !== 'right') continue;
    const key = `${seg.segmentId}-${seg.side}`;
    const entry: {
      refluxDurationMs?: number;
      apDiameterMm?: number;
      transDiameterMm?: number;
      depthMm?: number;
      compressibility?: 'non-compressible' | 'inconclusive';
    } = {};
    if (typeof seg.refluxDurationMs === 'number') entry.refluxDurationMs = seg.refluxDurationMs;
    if (typeof seg.diameterMm === 'number') {
      entry.apDiameterMm = seg.diameterMm;
      // Wave 4.3 — was `seg.diameterMm * 0.9`, a fake derivation that
      // implied a real clinical relationship between AP and transverse
      // diameters. Reviewers reading the sample PDF could be misled
      // into thinking the renderer was inferring trans from AP. Use a
      // hardcoded plausible value instead so the fixture is honest:
      // it's just sample data, no math involved.
      entry.transDiameterMm = 5.9;
    }
    if (seg.competency === 'incompetent') entry.compressibility = 'non-compressible';
    if (seg.competency === 'inconclusive') entry.compressibility = 'inconclusive';
    mutableFindings[key] = entry;
  }
  const findings = mutableFindings as unknown as VenousSegmentFindings;

  const [anterior, posterior] = await Promise.all([
    loadAnatomyForPdf('le-anterior', findings),
    loadAnatomyForPdf('le-posterior', findings),
  ]);

  const element = createElement(ReportDocument, {
    form: mockForm,
    labels,
    org,
    preliminary: false,
    anatomy: { anterior, posterior },
    rightFindings,
    leftFindings,
    conclusions,
    generatedAt: '2026-04-23T14:15:00.000Z',
  });

  // renderToBuffer's type expects a ReactElement<DocumentProps>; our
  // ReportDocument returns a Document root but TS sees the outer shell as
  // ReportDocumentProps. Cast through unknown — safe since ReportDocument
  // always returns a <Document>.
  const buffer = await renderToBuffer(element as unknown as Parameters<typeof renderToBuffer>[0]);
  const outPath = '/tmp/sample-report.pdf';
  await writeFile(outPath, buffer);
  // eslint-disable-next-line no-console
  console.log(`Sample PDF written to ${outPath} (${buffer.length} bytes)`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
