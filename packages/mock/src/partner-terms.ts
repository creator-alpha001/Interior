import type { PartnerAgreement, PartnerTerms } from "@repo/types";
import { daysAgo, rec } from "./helpers";

/**
 * The agreement every professional signs before they can be sent a single
 * lead. Written to be read — a vendor who cannot understand what they signed
 * will argue about it later, and the contact clause in particular is the one
 * the whole commission model rests on.
 */
export const partnerTerms: PartnerTerms = {
  version: "2026.1",
  effectiveFrom: "2026-01-01",
  title: "Professional Partner Agreement",
  summary:
    "What you can expect from Aangan, what we expect from you, and how commission is calculated. Version 2026.1, effective 1 January 2026.",
  sections: [
    {
      heading: "1. What this agreement covers",
      body: "This agreement governs your use of the Aangan platform to receive customer enquiries, submit quotations, and carry out work for customers introduced to you by Aangan. It does not make you an employee, agent or partner of Aangan. You remain an independent business, responsible for your own crew, materials, tools, insurance and taxes.",
    },
    {
      heading: "2. Approval is per trade",
      body: "You are approved to receive leads only in the trades listed on your profile and only in the cities and localities you have registered. Approval in one trade does not extend to another: taking on work in a trade you are not approved for, or in an area you do not service, is a breach of this agreement. You may apply for additional trades at any time and we will assess each one separately.",
    },
    {
      heading: "3. Customer contact is coordinated by Aangan",
      body: "Aangan does not share customer telephone numbers or email addresses with you. You receive the locality of the job when it is assigned, and the full site address once a visit has been confirmed. All questions to a customer, and all answers back, go through the Aangan coordinator. You agree not to solicit a customer's direct contact details, not to contact them outside the platform, and not to offer to carry out the introduced work off-platform. This clause is what allows us to keep the enquiry free for customers.",
    },
    {
      heading: "4. Quoting",
      body: "You quote against the brief captured by our team and against measurements from your own site visit. Quotes must be itemised, must state the timeline, warranty and materials you will actually use, and must be inclusive of all taxes you intend to charge. If a site visit changes the scope, we will tell you and you may revise your quote. A quote you have submitted stands for 30 days unless withdrawn in writing through the platform.",
    },
    {
      heading: "5. Commission",
      body: "Commission is charged only on work you win. It is calculated on the agreed price at the moment the customer signs their agreement, at the rate shown on your profile for that trade. Commission is invoiced per agreement, not per job: where one customer engages you across several services under a single agreement, you receive one invoice covering all of them. Invoices are payable within 15 days.",
    },
    {
      heading: "6. Cancellation",
      body: "If a project is cancelled before work has started, commission on it is waived. If work has started, commission stands at the agreed amount unless Aangan adjusts it, which we may do at our discretion where the cancellation was not your fault. Any adjustment and its reason is recorded against the invoice.",
    },
    {
      heading: "7. Standards of work",
      body: "You will carry out work to the specification and timeline in your accepted quote, using the materials you specified. You will honour the warranty you offered. Where a customer raises a complaint through Aangan, you will respond within two working days and work with our team in good faith to resolve it.",
    },
    {
      heading: "8. Ratings and reviews",
      body: "Customers rate each completed project separately, per trade. Ratings are published on your profile and are not editable by you or by us, except where a review breaches our content policy. Two unresolved complaints will move your account to review, and an account under review stops receiving new leads until the matter is closed.",
    },
    {
      heading: "9. Evidence of completion",
      body: "For each stage of a project you will record progress on the platform and upload photographs evidencing the work at that stage. This is what allows us to answer the customer's questions without calling you, and is the record we rely on if the work is later disputed.",
    },
    {
      heading: "10. Suspension and termination",
      body: "Either party may end this agreement with 30 days' written notice. Aangan may suspend your account immediately for a breach of the contact clause, for repeated failure to honour quoted terms, or where there is a credible safety or fraud concern. Work already under agreement with a customer must be completed, or handed over in an orderly way, notwithstanding suspension.",
    },
    {
      heading: "11. Data and confidentiality",
      body: "Customer information you receive through the platform may be used only to quote for and carry out that customer's job. You will not retain it after the job is closed, share it with third parties, or use it for marketing.",
    },
    {
      heading: "12. Governing law",
      body: "This agreement is governed by the laws of India, and the courts at Lucknow, Uttar Pradesh have exclusive jurisdiction over any dispute arising from it.",
    },
  ],
  acknowledgements: [
    {
      key: "contact",
      label:
        "I will not ask customers for their direct contact details, contact them off-platform, or offer to do the introduced work outside Aangan.",
    },
    {
      key: "commission",
      label:
        "I understand commission is charged on work I win, at my rate for that trade, invoiced once per agreement and payable within 15 days.",
    },
    {
      key: "trades",
      label:
        "I will only take work in the trades and service areas I am approved for, and will apply separately for any others.",
    },
    {
      key: "evidence",
      label:
        "I will record each project stage on the platform and upload photographs as evidence of completion.",
    },
    {
      key: "warranty",
      label: "I will honour the timeline, materials and warranty stated in the quotes I submit.",
    },
  ],
};

interface SignedSeed {
  professionalId: string;
  signatory: string;
  role: string;
  daysAgoSigned: number;
}

const signed: SignedSeed[] = [
  { professionalId: "pro-aarohi", signatory: "Aarohi Verma", role: "Proprietor", daysAgoSigned: 292 },
  { professionalId: "pro-imran", signatory: "Imran Qureshi", role: "Managing Partner", daysAgoSigned: 288 },
  { professionalId: "pro-nidhi", signatory: "Nidhi Srivastava", role: "Founder", daysAgoSigned: 275 },
  { professionalId: "pro-rakesh", signatory: "Rakesh Yadav", role: "Proprietor", daysAgoSigned: 270 },
  { professionalId: "pro-sunita", signatory: "Sunita Rawat", role: "Director", daysAgoSigned: 262 },
  { professionalId: "pro-devendra", signatory: "Devendra Singh", role: "Proprietor", daysAgoSigned: 255 },
  { professionalId: "pro-vinod", signatory: "Vinod Kumar", role: "Partner", daysAgoSigned: 240 },
  { professionalId: "pro-santosh", signatory: "Santosh Kumar", role: "Proprietor", daysAgoSigned: 232 },
  { professionalId: "pro-jyoti", signatory: "Jyoti Devi", role: "Proprietor", daysAgoSigned: 210 },
  { professionalId: "pro-harpreet", signatory: "Harpreet Kaur", role: "Founder", daysAgoSigned: 180 },
];

export const partnerAgreements: PartnerAgreement[] = [
  ...signed.map((s, i) => ({
    ...rec(s.daysAgoSigned, s.daysAgoSigned),
    id: `pa-${s.professionalId}`,
    professionalId: s.professionalId,
    termsVersion: partnerTerms.version,
    status: "signed" as const,
    signatureText: s.signatory,
    signatoryName: s.signatory,
    signatoryRole: s.role,
    signedAt: daysAgo(s.daysAgoSigned),
    acknowledgedClauses: partnerTerms.acknowledgements.map((a) => a.key),
    signedFromIp: `49.36.${180 + i}.${20 + i * 3}`,
    signedUserAgent: "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36",
    documentUrl: `/mock/partner-agreements/${s.professionalId}-2026.1.pdf`,
  })),
  // Arif has been verified but never signed — so he is in no lead pool, which
  // is the rule made visible rather than an oversight in the data.
  {
    ...rec(120, 120),
    id: "pa-pro-arif",
    professionalId: "pro-arif",
    termsVersion: partnerTerms.version,
    status: "pending",
    signatureText: null,
    signatoryName: null,
    signatoryRole: null,
    signedAt: null,
    acknowledgedClauses: [],
    signedFromIp: null,
    signedUserAgent: null,
    documentUrl: null,
  },
  {
    ...rec(40, 40),
    id: "pa-pro-ganesh",
    professionalId: "pro-ganesh",
    termsVersion: partnerTerms.version,
    status: "pending",
    signatureText: null,
    signatoryName: null,
    signatoryRole: null,
    signedAt: null,
    acknowledgedClauses: [],
    signedFromIp: null,
    signedUserAgent: null,
    documentUrl: null,
  },
];
