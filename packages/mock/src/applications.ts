/**
 * Somebody waiting to hear whether they can sell here.
 *
 * One row, and one on purpose. The reviewer's queue is a screen nobody would
 * ever see working on seed data otherwise — an empty queue looks identical to a
 * broken one — and a single application is enough to walk the decision through
 * end to end without a database.
 *
 * It belongs to Sameer rather than to Priya, who is the identity the demo signs
 * in as. That way both halves of the flow are visible at once: the demo
 * customer still sees the blank application form on their account, and ops
 * still have something real to approve or refuse.
 */
import type { ProfessionalApplication } from "@repo/types";
import { daysAgo, rec } from "./helpers";

export const professionalApplications: ProfessionalApplication[] = [
  {
    ...rec(6, 6),
    id: "app-sameer",
    userId: "user-client-sameer",
    companyName: "Ahmad & Sons Woodcraft",
    gstNumber: null,
    experienceYears: 14,
    bio:
      "Third-generation carpentry workshop in Chowk. Six full-time carpenters and two polishers. " +
      "We take on modular kitchens, wardrobes and full-house furniture, mostly in Indian plywood " +
      "with a preference for BWP-grade for anything near water. Recent work: a four-bedroom " +
      "handover in Gomti Nagar Extension and a restaurant fit-out on Hazratganj.",
    contactName: "Sameer Ahmad",
    contactMobile: "9026781134",
    requestedDomainIds: ["dom-furniture", "dom-interior"],
    serviceCityIds: ["city-luc", "city-knp"],
    serviceAreaNote:
      "Anywhere in Lucknow. Kanpur only for jobs over two lakh, since it is a day's travel each way.",
    status: "submitted",
    submittedAt: daysAgo(6),
    decidedAt: null,
    decidedByUserId: null,
    reviewerNote: null,
    professionalId: null,
  },
];
