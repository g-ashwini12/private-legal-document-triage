import { DocumentMetadata, Chunk, DocumentAnalysisCards, AnswerResponse } from '@/types';

export const DEMO_DOCUMENT_ID = 'demo-rental-agreement';

export const DEMO_METADATA: DocumentMetadata = {
  document_id: DEMO_DOCUMENT_ID,
  filename: 'sample_rental_agreement_2026.pdf',
  file_hash: '67e631caeaa0a3bdc8769a9a729b3ed0a1fd733a09d24a17e464d7f038d896d9',
  page_count: 3,
  doc_type: 'rental',
  chunk_count: 10,
  truncated: false,
  summary: 'Residential rental agreement between Ravi Menon (Landlord) and Ananya Rao (Tenant) for Flat 4B, Lakeview Residency, Dharwad for 11 months with ₹18,000 monthly rent and ₹54,000 security deposit.',
  created_at: '2026-11-01 18:24:59',
};

export const DEMO_CHUNKS: Chunk[] = [
  {
    chunk_id: 'c1',
    document_id: DEMO_DOCUMENT_ID,
    page: 1,
    clause_number: '1',
    heading: '1. Parties and Property',
    text: '1. Parties and Property. This agreement is made on 25 October 2026 between Ravi Menon ("Landlord") and Ananya Rao ("Tenant") for Flat 4B, Lakeview Residency, Dharwad.',
  },
  {
    chunk_id: 'c2',
    document_id: DEMO_DOCUMENT_ID,
    page: 1,
    clause_number: '2',
    heading: '2. Term',
    text: '2. Term. The tenancy lasts 11 months, from 1 November 2026 to 30 September 2027.',
  },
  {
    chunk_id: 'c3',
    document_id: DEMO_DOCUMENT_ID,
    page: 1,
    clause_number: '3',
    heading: '3. Rent and Late Fee',
    text: '3. Rent and Late Fee. Monthly rent is ₹18,000, payable on or before the 5th of each month. A late fee of ₹200 per day applies from the 6th until payment.',
  },
  {
    chunk_id: 'c4',
    document_id: DEMO_DOCUMENT_ID,
    page: 2,
    clause_number: '4',
    heading: '4. Security Deposit',
    text: "4. Security Deposit. The Tenant shall pay a deposit of ₹54,000 (three months' rent) before moving in. The deposit will be refunded within 60 days after the Tenant vacates, after deductions that the Landlord may make at his sole discretion.",
  },
  {
    chunk_id: 'c5',
    document_id: DEMO_DOCUMENT_ID,
    page: 2,
    clause_number: '5',
    heading: '5. Renewal and Notice',
    text: '5. Renewal and Notice. The agreement renews automatically for another 11 months with up to a 15% rent increase unless either party provides 30 days written notice prior to expiry.',
  },
  {
    chunk_id: 'c6',
    document_id: DEMO_DOCUMENT_ID,
    page: 2,
    clause_number: '6',
    heading: '6. Lock-in Period',
    text: '6. Lock-in Period. There is a mandatory lock-in period of six (6) months starting 1 November 2026. Early termination by the Tenant within this period results in complete forfeiture of the security deposit plus a 2-month rent penalty.',
  },
  {
    chunk_id: 'c7',
    document_id: DEMO_DOCUMENT_ID,
    page: 2,
    clause_number: '7',
    heading: '7. Repairs and Maintenance',
    text: '7. Repairs. The Tenant shall bear the cost of all repairs and maintenance, including structural repairs, regardless of cause.',
  },
  {
    chunk_id: 'c8',
    document_id: DEMO_DOCUMENT_ID,
    page: 3,
    clause_number: '8',
    heading: '8. Landlord Inspection & Entry',
    text: '8. Inspection. The Landlord or authorized agent shall have the right to enter the property at any time without prior notice to inspect the condition.',
  },
  {
    chunk_id: 'c9',
    document_id: DEMO_DOCUMENT_ID,
    page: 3,
    clause_number: '9',
    heading: '9. Permitted Use & Alterations',
    text: '9. Use. The premises shall be used solely for residential purposes by the named Tenant. No structural changes, painting, or heavy nail work is permitted without written consent.',
  },
  {
    chunk_id: 'c10',
    document_id: DEMO_DOCUMENT_ID,
    page: 3,
    clause_number: '10',
    heading: '10. Utilities and Bills',
    text: '10. Utilities. The Tenant shall pay electricity, water, and internet bills directly to service providers on time.',
  },
];

export const DEMO_CARDS: DocumentAnalysisCards = {
  document_id: DEMO_DOCUMENT_ID,
  language: 'en',
  summary:
    'This is a residential rental agreement between Ravi Menon (Landlord) and Ananya Rao (Tenant) for Flat 4B, Lakeview Residency, Dharwad for 11 months (1 Nov 2026 to 30 Sep 2027). Monthly rent is ₹18,000, and deposit is ₹54,000. It contains 3 high-risk clauses (sole-discretion deposit deductions, 24/7 unannounced entry, and tenant liability for structural repairs) that should be negotiated before signing.',
  summary_en:
    'This is a residential rental agreement between Ravi Menon (Landlord) and Ananya Rao (Tenant) for Flat 4B, Lakeview Residency, Dharwad for 11 months (1 Nov 2026 to 30 Sep 2027). Monthly rent is ₹18,000, and deposit is ₹54,000. It contains 3 high-risk clauses (sole-discretion deposit deductions, 24/7 unannounced entry, and tenant liability for structural repairs) that should be negotiated before signing.',
  key_details: [
    {
      category: 'Parties & People',
      label: 'Parties to Agreement',
      value: 'Ravi Menon ("Landlord") and Ananya Rao ("Tenant")',
      clause_ref: 'Clause 1',
      page: 1,
      quote: '1. Parties and Property. This agreement is made on 25 October 2026 between Ravi Menon ("Landlord") and Ananya Rao ("Tenant") for Flat 4B, Lakeview Residency, Dharwad.',
    },
    {
      category: 'Amounts & Money',
      label: 'Monthly Rent',
      value: '₹18,000',
      clause_ref: 'Clause 3',
      page: 1,
      quote: '3. Rent and Late Fee. Monthly rent is ₹18,000, payable on or before the 5th of each month.',
    },
    {
      category: 'Amounts & Money',
      label: 'Daily Late Fine',
      value: '₹200 per day',
      clause_ref: 'Clause 3',
      page: 1,
      quote: 'A late fee of ₹200 per day applies from the 6th until payment.',
    },
    {
      category: 'Amounts & Money',
      label: 'Security Deposit',
      value: '₹54,000 (3 Months)',
      clause_ref: 'Clause 4',
      page: 2,
      quote: "4. Security Deposit. The Tenant shall pay a deposit of ₹54,000 (three months' rent) before moving in.",
    },
    {
      category: 'Key Dates',
      label: 'Agreement Start Date',
      value: '1 November 2026',
      clause_ref: 'Clause 2',
      page: 1,
      quote: '2. Term. The tenancy lasts 11 months, from 1 November 2026 to 30 September 2027.',
    },
    {
      category: 'Key Dates',
      label: 'Agreement Expiry Date',
      value: '30 September 2027',
      clause_ref: 'Clause 2',
      page: 1,
      quote: 'The tenancy lasts 11 months, from 1 November 2026 to 30 September 2027.',
    },
  ],
  watch_out_risks: [
    {
      clause_ref: 'Clause 4',
      page: 2,
      level: 'High',
      headline: "Deductions from deposit at owner's sole choice",
      explanation: 'The landlord claims unilateral authority to deduct repair costs or withhold your deposit without providing contractor invoices or receipts.',
      suggested_question: 'Can we require written receipts, contractor invoices, and photographs before any deposit deduction?',
      quote: 'The deposit will be refunded within 60 days after the Tenant vacates, after deductions that the Landlord may make at his sole discretion.',
      headline_en: "Deductions from deposit at owner's sole choice",
      explanation_en: 'The landlord claims unilateral authority to deduct repair costs or withhold your deposit without providing contractor invoices or receipts.',
      suggested_question_en: 'Can we require written receipts, contractor invoices, and photographs before any deposit deduction?',
    },
    {
      clause_ref: 'Clause 8',
      page: 3,
      level: 'High',
      headline: 'Owner can enter your home anytime without notice',
      explanation: 'The landlord claims the right to enter your home at any hour without prior notice, infringing your fundamental legal right to quiet enjoyment.',
      suggested_question: 'Can we amend this clause to require at least 24 hours written notice before any inspection, during reasonable daylight hours?',
      quote: 'The Landlord or authorized agent shall have the right to enter the property at any time without prior notice to inspect the condition.',
      headline_en: 'Owner can enter your home anytime without notice',
      explanation_en: 'The landlord claims the right to enter your home at any hour without prior notice, infringing your fundamental legal right to quiet enjoyment.',
      suggested_question_en: 'Can we amend this clause to require at least 24 hours written notice before any inspection, during reasonable daylight hours?',
    },
    {
      clause_ref: 'Clause 7',
      page: 2,
      level: 'High',
      headline: 'Tenant forced to pay for structural building repairs',
      explanation: 'This clause unfairly shifts the burden of structural building defects (roof, seepage, foundation cracks) onto the tenant regardless of cause.',
      suggested_question: 'Can the landlord remain responsible for structural defects and major building maintenance not caused by tenant negligence?',
      quote: 'The Tenant shall bear the cost of all repairs and maintenance, including structural repairs, regardless of cause.',
      headline_en: 'Tenant forced to pay for structural building repairs',
      explanation_en: 'This clause unfairly shifts the burden of structural building defects (roof, seepage, foundation cracks) onto the tenant regardless of cause.',
      suggested_question_en: 'Can the landlord remain responsible for structural defects and major building maintenance not caused by tenant negligence?',
    },
    {
      clause_ref: 'Clause 6',
      page: 2,
      level: 'Medium',
      headline: 'Strict 6-month lock-in with dual penalty',
      explanation: 'Vacating before 30 April 2027 triggers total deposit forfeiture plus 2 months extra rent fine.',
      suggested_question: 'Can the early exit penalty be capped at 1 month rent if job transfer or emergency arises?',
      quote: 'Mandatory lock-in period of six (6) months. Early termination results in complete forfeiture of the security deposit plus a 2-month rent penalty.',
      headline_en: 'Strict 6-month lock-in with dual penalty',
      explanation_en: 'Vacating before 30 April 2027 triggers total deposit forfeiture plus 2 months extra rent fine.',
      suggested_question_en: 'Can the early exit penalty be capped at 1 month rent if job transfer or emergency arises?',
    },
  ],
  what_you_must_do: [
    {
      who: 'You (Tenant)',
      action: 'Pay monthly rent of ₹18,000 on or before the 5th of each calendar month.',
      clause_ref: 'Clause 3',
      page: 1,
      quote: 'Monthly rent is ₹18,000, payable on or before the 5th of each month.',
      action_en: 'Pay monthly rent of ₹18,000 on or before the 5th of each calendar month.',
    },
    {
      who: 'You (Tenant)',
      action: 'Serve 30 days written notice before 30 September 2027 to prevent automatic renewal at 15% higher rent.',
      clause_ref: 'Clause 5',
      page: 2,
      quote: 'The agreement renews automatically for another 11 months with up to a 15% rent increase unless either party provides 30 days written notice.',
      action_en: 'Serve 30 days written notice before 30 September 2027 to prevent automatic renewal at 15% higher rent.',
    },
    {
      who: 'You (Tenant)',
      action: 'Pay electricity, water, and internet utility bills directly to service providers.',
      clause_ref: 'Clause 10',
      page: 3,
      quote: 'The Tenant shall pay electricity, water, and internet bills directly to service providers.',
      action_en: 'Pay electricity, water, and internet utility bills directly to service providers.',
    },
  ],
  important_dates: [
    {
      date_iso: '2026-11-01',
      date_display: '1 November 2026',
      event: 'Tenancy start date and security deposit payment due',
      clause_ref: 'Clause 2 & 4',
      page: 1,
      quote: 'The tenancy lasts 11 months, from 1 November 2026 to 30 September 2027.',
      event_en: 'Tenancy start date and security deposit payment due',
    },
    {
      date_iso: '2026-11-05',
      date_display: '5th of Every Month',
      event: 'Monthly rent due date (daily late fines begin on the 6th)',
      clause_ref: 'Clause 3',
      page: 1,
      quote: 'Monthly rent is ₹18,000, payable on or before the 5th of each month.',
      event_en: 'Monthly rent due date (daily late fines begin on the 6th)',
    },
    {
      date_iso: '2027-04-30',
      date_display: '30 April 2027',
      event: 'End of mandatory 6-month lock-in period (can terminate after this date without dual penalty)',
      clause_ref: 'Clause 6',
      page: 2,
      quote: 'There is a mandatory lock-in period of six (6) months.',
      event_en: 'End of mandatory 6-month lock-in period (can terminate after this date without dual penalty)',
    },
    {
      date_iso: '2027-08-31',
      date_display: '31 August 2027',
      event: '30-Day notice deadline to avoid automatic 15% rent hike renewal',
      clause_ref: 'Clause 5',
      page: 2,
      quote: 'Renews automatically for another 11 months with up to a 15% rent increase unless 30 days written notice is given.',
      event_en: '30-Day notice deadline to avoid automatic 15% rent hike renewal',
    },
    {
      date_iso: '2027-09-30',
      date_display: '30 September 2027',
      event: 'Tenancy term expiration date',
      clause_ref: 'Clause 2',
      page: 1,
      quote: 'Tenancy lasts 11 months, from 1 November 2026 to 30 September 2027.',
      event_en: 'Tenancy term expiration date',
    },
    {
      date_iso: '2027-11-29',
      date_display: '60 Days After Vacating',
      event: 'Maximum deadline for Landlord to refund security deposit',
      clause_ref: 'Clause 4',
      page: 2,
      quote: 'The deposit will be refunded within 60 days after the Tenant vacates.',
      event_en: 'Maximum deadline for Landlord to refund security deposit',
    },
  ],
  lawyer_advice: {
    should_see_lawyer: true,
    reason: 'The agreement contains unilateral 24/7 entry rights, sole-discretion deposit deductions, and complete liability for structural repairs.',
    what_to_ask: 'How to mandate 24 hours written notice for entry, limit deposit deductions to original contractor receipts, and make landlord liable for structural defects.',
    by_when: 'Before signing the contract or handing over the ₹54,000 security deposit.',
    recommended_specialist: 'Tenancy & Rental Agreement Lawyer',
    reason_en: 'The agreement contains unilateral 24/7 entry rights, sole-discretion deposit deductions, and complete liability for structural repairs.',
    what_to_ask_en: 'How to mandate 24 hours written notice for entry, limit deposit deductions to original contractor receipts, and make landlord liable for structural defects.',
    by_when_en: 'Before signing the contract or handing over the ₹54,000 security deposit.',
    recommended_specialist_en: 'Tenancy & Rental Agreement Lawyer',
  },
  suggested_questions: [
    'What is the security deposit and when do I get it back?',
    'Can the landlord enter my house without telling me?',
    'What happens if I need to move out before 6 months?',
    'Who pays if the roof or building has structural seepage?',
    'How much is the late fee if I pay rent after the 5th?',
  ],
  suggested_questions_en: [
    'What is the security deposit and when do I get it back?',
    'Can the landlord enter my house without telling me?',
    'What happens if I need to move out before 6 months?',
    'Who pays if the roof or building has structural seepage?',
    'How much is the late fee if I pay rent after the 5th?',
  ],
  confidence_level: 'High',
  checked_against_document: true,
};

export function getDemoAnswer(question: string, language: string = 'en'): AnswerResponse {
  const q = question.toLowerCase().trim();

  if (q.includes('hello') || q.includes('hi') || q.includes('hey') || q.includes('namaste') || q.includes('namaskara')) {
    const greetingMap: Record<string, string> = {
      en: "Hello! 👋 I am your Private Legal Document Assistant. I've analyzed your rental agreement and I'm right here to help you understand every clause with complete clarity. Feel free to ask about your rent, deposit refund, lock-in period, repairs, or any restrictions!",
      hi: 'नमस्ते! 👋 मैं आपका निजी कानूनी दस्तावेज़ सहायक हूँ। मैंने आपके किराये के समझौते का विश्लेषण किया है। किराया, जमा वापसी, लॉक-इन अवधि या किसी भी नियम के बारे में बेझिझक पूछें!',
      kn: 'ನಮಸ್ಕಾರ! 👋 ನಾನು ನಿಮ್ಮ ಖಾಸಗಿ ಕಾನೂನು ದಾಖಲೆ ಸಹಾಯಕ. ನಿಮ್ಮ ಬಾಡಿಗೆ ಒಪ್ಪಂದವನ್ನು ನಾನು ವಿಶ್ಲೇಷಿಸಿದ್ದೇನೆ. ಬಾಡಿಗೆ, ಡೆಪಾಸಿಟ್ ಮರುಪಾವತಿ, ಅಥವಾ ಯಾವುದೇ ನಿಯಮಗಳ ಬಗ್ಗೆ ನೀವು ಕೇಳಬಹುದು!',
      ta: 'வணக்கம்! 👋 நான் உங்கள் தனிப்பட்ட சட்ட ஆவண உதவியாளர். உங்கள் வாடகை ஒப்பந்தத்தை நான் ஆய்வு செய்துள்ளேன். வாடகை, முன்பணம் அல்லது விதிகள் பற்றி நீங்கள் கேட்கலாம்!',
      te: 'నమస్కారం! 👋 నేను మీ ప్రైవేట్ లీగల్ అసిస్టెంట్‌ని. మీ అద్దె ఒప్పందాన్ని నేను పరిశీలించాను. అద్దె, డిపాజిట్ లేదా నిబంధనల గురించి నన్ను అడగండి!',
      ml: 'നമസ്കാരം! 👋 ഞാൻ നിങ്ങളുടെ സ്വകാര്യ നിയമ രേഖാ സഹായിയാണ്. നിങ്ങളുടെ വാടക കരാർ ഞാൻ പരിശോധിച്ചു. വാടക, ഡെപ്പോസിറ്റ് എന്നിവയെക്കുറിച്ച് ചോദിക്കാം!',
    };
    return {
      answer: greetingMap[language] || greetingMap.en,
      answer_en: greetingMap.en,
      language,
      clauses: [],
      evidence: [],
      confidence_level: 'High',
      checked_against_document: true,
    };
  }

  if (q.includes('ashwini')) {
    return {
      answer:
        "I searched the entire agreement, but there is no mention of 'Ashwini'. The parties legally recognized in this contract are Ravi Menon (Landlord) and Ananya Rao (Tenant). Note: If Ashwini will reside in the property, pay rent, or act as a guarantor, their legal name and rights must be added to the document in writing before signing.",
      answer_en:
        "I searched the entire agreement, but there is no mention of 'Ashwini'. The parties legally recognized in this contract are Ravi Menon (Landlord) and Ananya Rao (Tenant). Note: If Ashwini will reside in the property, pay rent, or act as a guarantor, their legal name and rights must be added to the document in writing before signing.",
      language,
      clauses: [],
      evidence: [],
      confidence_level: 'High',
      checked_against_document: true,
    };
  }

  if (q.includes('why') && q.length < 15) {
    return {
      answer:
        'Because in contract law, only parties and conditions formally documented in the signed agreement have legal standing. If someone is not listed as a party or permitted occupant, the landlord is not legally bound to recognize their tenancy, and oral understandings cannot be enforced in court. Always ensure all names and agreements are documented in black and white.',
      answer_en:
        'Because in contract law, only parties and conditions formally documented in the signed agreement have legal standing. If someone is not listed as a party or permitted occupant, the landlord is not legally bound to recognize their tenancy, and oral understandings cannot be enforced in court. Always ensure all names and agreements are documented in black and white.',
      language,
      clauses: [],
      evidence: [],
      confidence_level: 'High',
      checked_against_document: true,
    };
  }

  if (q.includes('deposit') || q.includes('refund') || q.includes('advance')) {
    return {
      answer:
        'Under Clause 4, the security deposit is ₹54,000 (equivalent to three months rent). The agreement states it will be refunded within 60 days after you vacate. However, watch out: the clause allows the landlord to make deductions at his "sole discretion" without providing contractor receipts or repair estimates.',
      answer_en:
        'Under Clause 4, the security deposit is ₹54,000 (equivalent to three months rent). The agreement states it will be refunded within 60 days after you vacate. However, watch out: the clause allows the landlord to make deductions at his "sole discretion" without providing contractor receipts or repair estimates.',
      language,
      clauses: ['Clause 4 (page 2)'],
      evidence: [
        {
          chunk_id: 'c4',
          page: 2,
          clause: 'Clause 4',
          quote: "The Tenant shall pay a deposit of ₹54,000 (three months' rent) before moving in. The deposit will be refunded within 60 days after the Tenant vacates, after deductions that the Landlord may make at his sole discretion.",
        },
      ],
      confidence_level: 'High',
      checked_against_document: true,
    };
  }

  if (q.includes('rent') || q.includes('late fee') || q.includes('fine')) {
    return {
      answer:
        'Under Clause 3, the monthly rent is ₹18,000 payable on or before the 5th of each month. If paid on or after the 6th, a daily late fee of ₹200 applies until the payment is cleared.',
      answer_en:
        'Under Clause 3, the monthly rent is ₹18,000 payable on or before the 5th of each month. If paid on or after the 6th, a daily late fee of ₹200 applies until the payment is cleared.',
      language,
      clauses: ['Clause 3 (page 1)'],
      evidence: [
        {
          chunk_id: 'c3',
          page: 1,
          clause: 'Clause 3',
          quote: 'Monthly rent is ₹18,000, payable on or before the 5th of each month. A late fee of ₹200 per day applies from the 6th until payment.',
        },
      ],
      confidence_level: 'High',
      checked_against_document: true,
    };
  }

  if (q.includes('lock-in') || q.includes('lock in') || q.includes('early') || q.includes('leave') || q.includes('vacate')) {
    return {
      answer:
        'Under Clause 6, there is a mandatory lock-in period of 6 months (until 30 April 2027). If you vacate during this period, you will forfeit your entire ₹54,000 deposit AND be charged an additional 2-month rent penalty.',
      answer_en:
        'Under Clause 6, there is a mandatory lock-in period of 6 months (until 30 April 2027). If you vacate during this period, you will forfeit your entire ₹54,000 deposit AND be charged an additional 2-month rent penalty.',
      language,
      clauses: ['Clause 6 (page 2)'],
      evidence: [
        {
          chunk_id: 'c6',
          page: 2,
          clause: 'Clause 6',
          quote: 'There is a mandatory lock-in period of six (6) months. Early termination by the Tenant within this period results in complete forfeiture of the security deposit plus a 2-month rent penalty.',
        },
      ],
      confidence_level: 'High',
      checked_against_document: true,
    };
  }

  if (q.includes('enter') || q.includes('visit') || q.includes('inspection') || q.includes('notice')) {
    return {
      answer:
        'Under Clause 8, the landlord claims the right to enter your flat at any time without advance warning. This is a severe invasion of privacy under tenancy standards; you should request an amendment requiring at least 24 hours written notice before any inspection.',
      answer_en:
        'Under Clause 8, the landlord claims the right to enter your flat at any time without advance warning. This is a severe invasion of privacy under tenancy standards; you should request an amendment requiring at least 24 hours written notice before any inspection.',
      language,
      clauses: ['Clause 8 (page 3)'],
      evidence: [
        {
          chunk_id: 'c8',
          page: 3,
          clause: 'Clause 8',
          quote: 'The Landlord or authorized agent shall have the right to enter the property at any time without prior notice to inspect the condition.',
        },
      ],
      confidence_level: 'High',
      checked_against_document: true,
    };
  }

  // Default fallback answer citing relevant clauses
  return {
    answer:
      'According to the agreement between Ravi Menon and Ananya Rao for Flat 4B Lakeview Residency, this agreement is binding for 11 months from 1 Nov 2026 to 30 Sep 2027 with monthly rent of ₹18,000 and deposit of ₹54,000. All obligations and rules are governed by Clauses 1 through 10.',
    answer_en:
      'According to the agreement between Ravi Menon and Ananya Rao for Flat 4B Lakeview Residency, this agreement is binding for 11 months from 1 Nov 2026 to 30 Sep 2027 with monthly rent of ₹18,000 and deposit of ₹54,000. All obligations and rules are governed by Clauses 1 through 10.',
    language,
    clauses: ['Clause 1', 'Clause 2', 'Clause 3'],
    evidence: [
      {
        chunk_id: 'c1',
        page: 1,
        clause: 'Clause 1',
        quote: '1. Parties and Property. This agreement is made on 25 October 2026 between Ravi Menon and Ananya Rao for Flat 4B, Lakeview Residency.',
      },
    ],
    confidence_level: 'High',
    checked_against_document: true,
  };
}
