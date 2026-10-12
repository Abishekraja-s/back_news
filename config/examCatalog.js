/** TNPSC + Bank exam catalog for Daily Quiz / mock tests */

export const EXAM_CATEGORIES = [
  {
    id: 'tnpsc',
    name: 'TNPSC',
    nameTamil: 'டிஎன்பிஎஸ்சி',
    color: '#2563eb',
    exams: [
      { slug: 'tnpsc-group-1', name: 'TNPSC Group 1', nameTamil: 'டிஎன்பிஎஸ்சி குரூப் 1', topics: ['tn-gk', 'polity', 'history', 'economy'] },
      { slug: 'tnpsc-group-1a', name: 'TNPSC Group 1A', nameTamil: 'டிஎன்பிஎஸ்சி குரூப் 1A', topics: ['tn-gk', 'polity', 'history'] },
      { slug: 'tnpsc-group-1b', name: 'TNPSC Group 1B', nameTamil: 'டிஎன்பிஎஸ்சி குரூப் 1B', topics: ['tn-gk', 'polity', 'economy'] },
      { slug: 'tnpsc-group-1c', name: 'TNPSC Group 1C', nameTamil: 'டிஎன்பிஎஸ்சி குரூப் 1C', topics: ['tn-gk', 'polity'] },
      { slug: 'tnpsc-group-2', name: 'TNPSC Group 2', nameTamil: 'டிஎன்பிஎஸ்சி குரூப் 2', topics: ['tn-gk', 'polity', 'history', 'aptitude'] },
      { slug: 'tnpsc-group-2a', name: 'TNPSC Group 2A', nameTamil: 'டிஎன்பிஎஸ்சி குரூப் 2A', topics: ['tn-gk', 'polity', 'aptitude'] },
      { slug: 'tnpsc-group-3', name: 'TNPSC Group 3', nameTamil: 'டிஎன்பிஎஸ்சி குரூப் 3', topics: ['tn-gk', 'aptitude', 'history'] },
      { slug: 'tnpsc-group-4', name: 'TNPSC Group 4', nameTamil: 'டிஎன்பிஎஸ்சி குரூப் 4', topics: ['tn-gk', 'aptitude', 'polity'] },
      { slug: 'tnpsc-group-5a', name: 'TNPSC Group 5A', nameTamil: 'டிஎன்பிஎஸ்சி குரூப் 5A', topics: ['tn-gk', 'polity'] },
      { slug: 'tnpsc-group-6', name: 'TNPSC Group 6', nameTamil: 'டிஎன்பிஎஸ்சி குரூப் 6', topics: ['tn-gk', 'aptitude'] },
      { slug: 'tnpsc-group-7', name: 'TNPSC Group 7', nameTamil: 'டிஎன்பிஎஸ்சி குரூப் 7', topics: ['tn-gk', 'history'] },
      { slug: 'tnpsc-group-8', name: 'TNPSC Group 8', nameTamil: 'டிஎன்பிஎஸ்சி குரூப் 8', topics: ['tn-gk', 'aptitude'] },
      { slug: 'tnpsc-cese', name: 'Combined Engineering Services', nameTamil: 'ஒருங்கிணைந்த பொறியியல் சேவை', topics: ['engineering', 'aptitude', 'tn-gk'] },
      { slug: 'tnpsc-ctse-diploma', name: 'Combined Technical Services – Diploma / ITI', nameTamil: 'தொழில்நுட்ப சேவை – டிப்ளமோ / ஐடிஐ', topics: ['engineering', 'aptitude'] },
      { slug: 'tnpsc-ctse-degree', name: 'Combined Technical Services – Degree / PG', nameTamil: 'தொழில்நுட்ப சேவை – பட்டம் / முதுநிலை', topics: ['engineering', 'aptitude', 'polity'] },
      { slug: 'tnpsc-civil-judge', name: 'Civil Judge Examination', nameTamil: 'சிவில் நீதிபதி தேர்வு', topics: ['law', 'polity', 'tn-gk'] },
      { slug: 'tnpsc-app', name: 'Assistant Public Prosecutor', nameTamil: 'உதவி பொது வழக்குரைஞர்', topics: ['law', 'polity'] },
      { slug: 'tnpsc-acf', name: 'Assistant Conservator of Forests', nameTamil: 'உதவி வன பாதுகாவலர்', topics: ['environment', 'tn-gk', 'aptitude'] },
      { slug: 'tnpsc-departmental', name: 'Departmental Examinations', nameTamil: 'துறைத் தேர்வுகள்', topics: ['polity', 'tn-gk', 'aptitude'] },
    ],
  },
  {
    id: 'bank',
    name: 'Bank Exams',
    nameTamil: 'வங்கி தேர்வுகள்',
    color: '#16a34a',
    exams: [
      { slug: 'ibps-po', name: 'IBPS PO', nameTamil: 'ஐபிபிஎஸ் பிஓ', topics: ['banking', 'aptitude', 'english', 'reasoning'] },
      { slug: 'ibps-clerk', name: 'IBPS Clerk', nameTamil: 'ஐபிபிஎஸ் கிளார்க்', topics: ['banking', 'aptitude', 'reasoning'] },
      { slug: 'ibps-so', name: 'IBPS SO', nameTamil: 'ஐபிபிஎஸ் எஸ்ஓ', topics: ['banking', 'aptitude', 'reasoning'] },
      { slug: 'ibps-rrb-po', name: 'IBPS RRB PO', nameTamil: 'ஐபிபிஎஸ் ஆர்ஆர்பி பிஓ', topics: ['banking', 'aptitude', 'reasoning'] },
      { slug: 'ibps-rrb-clerk', name: 'IBPS RRB Clerk', nameTamil: 'ஐபிபிஎஸ் ஆர்ஆர்பி கிளார்க்', topics: ['banking', 'aptitude'] },
      { slug: 'sbi-po', name: 'SBI PO', nameTamil: 'எஸ்பிஐ பிஓ', topics: ['banking', 'aptitude', 'reasoning', 'english'] },
      { slug: 'sbi-clerk', name: 'SBI Clerk', nameTamil: 'எஸ்பிஐ கிளார்க்', topics: ['banking', 'aptitude', 'reasoning'] },
      { slug: 'sbi-so', name: 'SBI SO', nameTamil: 'எஸ்பிஐ எஸ்ஓ', topics: ['banking', 'aptitude'] },
      { slug: 'rbi-grade-b', name: 'RBI Grade B', nameTamil: 'ஆர்பிஐ கிரேடு பி', topics: ['banking', 'economy', 'aptitude'] },
      { slug: 'rbi-assistant', name: 'RBI Assistant', nameTamil: 'ஆர்பிஐ அசிஸ்டண்ட்', topics: ['banking', 'aptitude', 'reasoning'] },
      { slug: 'nabard-grade-a', name: 'NABARD Grade A', nameTamil: 'நாபார்டு கிரேடு ஏ', topics: ['banking', 'economy', 'agriculture'] },
      { slug: 'nabard-grade-b', name: 'NABARD Grade B', nameTamil: 'நாபார்டு கிரேடு பி', topics: ['banking', 'economy', 'agriculture'] },
      { slug: 'sebi-grade-a', name: 'SEBI Grade A', nameTamil: 'செபி கிரேடு ஏ', topics: ['banking', 'economy', 'aptitude'] },
      { slug: 'lic-aao', name: 'LIC AAO', nameTamil: 'எல்ஐசி ஏஏஓ', topics: ['banking', 'aptitude', 'reasoning'] },
      { slug: 'lic-assistant', name: 'LIC Assistant', nameTamil: 'எல்ஐசி அசிஸ்டண்ட்', topics: ['banking', 'aptitude'] },
      { slug: 'niacl-ao', name: 'NIACL AO', nameTamil: 'என்ஐஏசிஎல் ஏஓ', topics: ['banking', 'aptitude', 'reasoning'] },
      { slug: 'niacl-assistant', name: 'NIACL Assistant', nameTamil: 'என்ஐஏசிஎல் அசிஸ்டண்ட்', topics: ['banking', 'aptitude'] },
      { slug: 'ibps-law', name: 'IBPS Law Officer', nameTamil: 'ஐபிபிஎஸ் சட்ட அதிகாரி', topics: ['law', 'banking', 'aptitude'] },
      { slug: 'ibps-agri', name: 'IBPS Agriculture Officer', nameTamil: 'ஐபிபிஎஸ் விவசாய அதிகாரி', topics: ['agriculture', 'banking', 'aptitude'] },
      { slug: 'bank-apprentice', name: 'Bank Apprentice', nameTamil: 'வங்கி பயிற்சியாளர்', topics: ['banking', 'aptitude'] },
      { slug: 'canara-po', name: 'Canara Bank PO', nameTamil: 'கனரா வங்கி பிஓ', topics: ['banking', 'aptitude', 'reasoning'] },
      { slug: 'bob-po', name: 'Bank of Baroda PO', nameTamil: 'பேங்க் ஆஃப் பரோடா பிஓ', topics: ['banking', 'aptitude', 'reasoning'] },
    ],
  },
];

export const ALL_EXAMS = EXAM_CATEGORIES.flatMap((c) =>
  c.exams.map((e) => ({ ...e, category: c.id, categoryName: c.name, categoryNameTamil: c.nameTamil, color: c.color }))
);

export const findExam = (slug) => ALL_EXAMS.find((e) => e.slug === slug);

export const DAILY_QUIZ_SIZE = 5;
export const FULL_TEST_SIZE = 10;
export const MARKS_PER_QUESTION = 1;
