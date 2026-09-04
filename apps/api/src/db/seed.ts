/**
 * Loads the seed data from @repo/mock into a real database.
 *
 * This is what keeps the demo intact through the migration. The preview walks
 * one requirement — LD-1042 — from enquiry to a completed stage, and that story
 * is only convincing because every row lines up. Regenerating equivalent-looking
 * data would lose it, so the same rows are imported instead.
 *
 * Mock ids are readable strings ("pro-aarohi", "lead-1042"); the database uses
 * UUIDs. `uid()` maps between them deterministically, so re-running this script
 * produces identical ids and foreign keys still resolve.
 */
import "./as-owner";
import { eq, inArray, sql as raw } from "drizzle-orm";
import argon2 from "argon2";
import { v5 as uuidv5 } from "uuid";
import * as seed from "@repo/mock";
import { closeDatabase, db } from "./client";
import * as t from "./schema";

/** Fixed namespace, so "pro-aarohi" is the same UUID on every machine. */
const NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

const uid = (mockId: string): string => uuidv5(mockId, NAMESPACE);
const uidOrNull = (mockId: string | null | undefined): string | null =>
  mockId ? uid(mockId) : null;

/** Ratings are stored as integers times ten: 4.5 becomes 45. */
const x10 = (rating: number): number => Math.round(rating * 10);

let staffEmails: string[] = [];
let staffPassword = "";

async function main() {
  const started = Date.now();

  await db.transaction(async (tx) => {
    // Order matters: a child cannot be inserted before its parent exists.
    // Truncating first makes the script idempotent, which is what makes it
    // usable as "reset my dev database to the demo".
    await tx.execute(raw`
      TRUNCATE TABLE
        media_assets, notifications, ticket_replies, support_tickets, refunds,
        reviews, commission_invoices, project_milestones, projects,
        partner_agreements, partner_terms, agreement_lead_domains, agreements,
        messages, quotes, meetings, lead_sales_activities, lead_domain_items,
        lead_domain_assignments, lead_domains, leads,
        blog_post_tags, blog_posts, blog_tags, blog_categories, banners, testimonials,
        saved_items, package_items, service_packages, product_city_prices,
        products, product_categories,
        portfolio_items, professional_service_areas, professional_domains,
        referrals, device_tokens, audit_logs, rate_limits, staff_credentials,
        otp_challenges, sessions, admin_users, admin_roles,
        sales_agents, professionals, clients, users, domains, cities
      RESTART IDENTITY CASCADE
    `);

    /* ---------------- reference data ---------------- */

    await tx.insert(t.cities).values(
      seed.cities.map((c) => ({
        id: uid(c.id),
        name: c.name,
        slug: c.slug,
        state: c.state,
        isActive: c.isActive,
      })),
    );

    await tx.insert(t.domains).values(
      seed.domains.map((d) => ({
        id: uid(d.id),
        name: d.name,
        slug: d.slug,
        tagline: d.tagline,
        description: d.description,
        iconKey: d.iconKey,
        bannerUrl: d.bannerUrl,
        defaultCommissionPercent: d.defaultCommissionPercent,
        isActive: d.isActive,
        sortOrder: d.sortOrder,
        labels: d.labels,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      })),
    );

    /* ---------------- people ---------------- */

    await tx.insert(t.users).values(
      seed.users.map((u) => ({
        id: uid(u.id),
        name: u.name,
        // The mock stores ten-digit numbers; the API normalises to 91XXXXXXXXXX.
        mobile: u.mobile.length === 10 ? `91${u.mobile}` : u.mobile,
        email: u.email,
        role: u.role,
        cityId: uid(u.cityId),
        status: u.status,
        avatarUrl: u.avatarUrl,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
      })),
    );

    await tx.insert(t.clients).values(
      seed.clients.map((c) => ({
        id: uid(c.id),
        userId: uid(c.userId),
        address: c.address,
        referralCode: c.referralCode,
        referredByUserId: uidOrNull(c.referredByUserId),
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })),
    );

    await tx.insert(t.professionals).values(
      seed.professionals.map((p) => ({
        id: uid(p.id),
        userId: uid(p.userId),
        companyName: p.companyName,
        gstNumber: p.gstNumber,
        experienceYears: p.experienceYears,
        bio: p.bio,
        avgRatingX10: x10(p.avgRating),
        ratingCount: p.ratingCount,
        completedProjects: p.completedProjects,
        languages: p.languages,
        verificationStatus: p.verificationStatus,
        avgResponseHours: p.avgResponseHours,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
    );

    await tx.insert(t.salesAgents).values(
      seed.salesAgents.map((a) => ({
        id: uid(a.id),
        userId: uid(a.userId),
        assignedCityIds: a.assignedCityIds.map(uid),
        dailyTarget: a.dailyTarget,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
      })),
    );

    await tx.insert(t.adminRoles).values(
      seed.adminRoles.map((r) => ({
        id: uid(r.id),
        name: r.name,
        description: r.description,
        permissions: [...r.permissions],
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
    );

    /* ---------------- vendor capability ---------------- */

    await tx.insert(t.professionalDomains).values(
      seed.professionalDomains.map((pd) => ({
        id: uid(pd.id),
        professionalId: uid(pd.professionalId),
        domainId: uid(pd.domainId),
        verificationStatus: pd.verificationStatus,
        commissionPercentOverride: pd.commissionPercentOverride,
        avgRatingX10: x10(pd.avgRating),
        ratingCount: pd.ratingCount,
        completedProjects: pd.completedProjects,
        createdAt: pd.createdAt,
        updatedAt: pd.updatedAt,
      })),
    );

    await tx.insert(t.professionalServiceAreas).values(
      seed.professionalServiceAreas.map((a) => ({
        id: uid(a.id),
        professionalId: uid(a.professionalId),
        cityId: uid(a.cityId),
        localities: a.localities,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
      })),
    );

    await tx.insert(t.portfolioItems).values(
      seed.portfolioItems.map((p) => ({
        id: uid(p.id),
        professionalId: uid(p.professionalId),
        domainId: uid(p.domainId),
        title: p.title,
        description: p.description,
        moderationStatus: p.moderationStatus,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
    );

    /* ---------------- catalogue ---------------- */

    await tx.insert(t.productCategories).values(
      seed.productCategories.map((c) => ({
        id: uid(c.id),
        domainId: uid(c.domainId),
        parentId: uidOrNull(c.parentId),
        name: c.name,
        slug: c.slug,
        description: c.description,
        imageUrl: c.imageUrl,
        sortOrder: c.sortOrder,
        isActive: c.isActive,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })),
    );

    await tx.insert(t.products).values(
      seed.products.map((p) => ({
        id: uid(p.id),
        domainId: uid(p.domainId),
        categoryId: uid(p.categoryId),
        name: p.name,
        slug: p.slug,
        shortDescription: p.shortDescription,
        description: p.description,
        basePrice: p.basePrice,
        priceUnit: p.priceUnit,
        leadTimeDays: p.leadTimeDays,
        isCustomisable: p.isCustomisable,
        specs: p.specs,
        options: p.options,
        tags: p.tags,
        isFeatured: p.isFeatured,
        isActive: p.isActive,
        ratingX10: x10(p.rating),
        ratingCount: p.ratingCount,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
    );

    await tx.insert(t.productCityPrices).values(
      seed.productCityPrices.map((p) => ({
        id: uid(p.id),
        productId: uid(p.productId),
        cityId: uid(p.cityId),
        price: p.price,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
    );

    await tx.insert(t.servicePackages).values(
      seed.servicePackages.map((p) => ({
        id: uid(p.id),
        domainId: uid(p.domainId),
        name: p.name,
        slug: p.slug,
        shortDescription: p.shortDescription,
        description: p.description,
        price: p.price,
        priceBasis: p.priceBasis,
        durationDays: p.durationDays,
        inclusions: p.inclusions,
        exclusions: p.exclusions,
        isFeatured: p.isFeatured,
        isActive: p.isActive,
        badge: p.badge,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
    );

    await tx.insert(t.packageItems).values(
      seed.packageItems.map((i) => ({
        id: uid(i.id),
        packageId: uid(i.packageId),
        productId: uidOrNull(i.productId),
        label: i.label,
        quantity: i.quantity,
        createdAt: i.createdAt,
        updatedAt: i.updatedAt,
      })),
    );

    /* ---------------- content ---------------- */

    await tx.insert(t.blogCategories).values(
      seed.blogCategories.map((c) => ({
        id: uid(c.id),
        name: c.name,
        slug: c.slug,
        description: c.description,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })),
    );

    await tx.insert(t.blogTags).values(
      seed.blogTags.map((tag) => ({
        id: uid(tag.id),
        name: tag.name,
        slug: tag.slug,
        createdAt: tag.createdAt,
        updatedAt: tag.updatedAt,
      })),
    );

    await tx.insert(t.blogPosts).values(
      seed.blogPosts.map((p) => ({
        id: uid(p.id),
        title: p.title,
        slug: p.slug,
        excerpt: p.excerpt,
        body: p.body,
        coverImageUrl: p.coverImageUrl,
        authorName: p.authorName,
        authorRole: p.authorRole,
        categoryId: uid(p.categoryId),
        domainId: uidOrNull(p.domainId),
        status: p.status,
        publishedAt: p.publishedAt,
        readingMinutes: p.readingMinutes,
        seoTitle: p.seoTitle,
        seoDescription: p.seoDescription,
        ogImageUrl: p.ogImageUrl,
        isFeatured: p.isFeatured,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
    );

    // tagIds was an array column in the mock; here it is a join table, so
    // "everything tagged modular-kitchen" can use an index.
    const postTags = seed.blogPosts.flatMap((p) =>
      p.tagIds.map((tagId) => ({ postId: uid(p.id), tagId: uid(tagId) })),
    );
    if (postTags.length > 0) await tx.insert(t.blogPostTags).values(postTags);

    await tx.insert(t.banners).values(
      seed.banners.map((b) => ({
        id: uid(b.id),
        title: b.title,
        subtitle: b.subtitle,
        imageUrl: b.imageUrl,
        ctaLabel: b.ctaLabel,
        ctaHref: b.ctaHref,
        domainId: uidOrNull(b.domainId),
        cityIds: b.cityIds.map(uid),
        isActive: b.isActive,
        sortOrder: b.sortOrder,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
      })),
    );

    await tx.insert(t.testimonials).values(
      seed.testimonials.map((x) => ({
        id: uid(x.id),
        clientName: x.clientName,
        cityName: x.cityName,
        domainId: uid(x.domainId),
        rating: x.rating,
        quote: x.quote,
        avatarUrl: x.avatarUrl,
        createdAt: x.createdAt,
        updatedAt: x.updatedAt,
      })),
    );

    /* ---------------- partner terms ---------------- */

    await tx.insert(t.partnerTerms).values({
      version: seed.partnerTerms.version,
      effectiveFrom: seed.partnerTerms.effectiveFrom,
      title: seed.partnerTerms.title,
      summary: seed.partnerTerms.summary,
      sections: seed.partnerTerms.sections,
      acknowledgements: seed.partnerTerms.acknowledgements,
      isCurrent: true,
    });

    /* ---------------- the customer journey ---------------- */

    await tx.insert(t.leads).values(
      seed.leads.map((l) => ({
        id: uid(l.id),
        reference: l.reference,
        clientId: uid(l.clientId),
        cityId: uid(l.cityId),
        description: l.description,
        urgency: l.urgency,
        budgetMin: l.budgetMin,
        budgetMax: l.budgetMax,
        siteAccessibilityTags: l.siteAccessibilityTags,
        source: l.source,
        overallStatus: l.overallStatus,
        assignedSalesAgentId: uidOrNull(l.assignedSalesAgentId),
        createdAt: l.createdAt,
        updatedAt: l.updatedAt,
      })),
    );

    // selected_quote_id is deliberately left null on this pass: the composite
    // foreign key points at quotes, which do not exist yet. It is filled in
    // after the quotes are inserted, below.
    await tx.insert(t.leadDomains).values(
      seed.leadDomains.map((ld) => ({
        id: uid(ld.id),
        leadId: uid(ld.leadId),
        domainId: uid(ld.domainId),
        materialSource: ld.materialSource,
        status: ld.status,
        preferredProfessionalId: uidOrNull(ld.preferredProfessionalId),
        preferenceUnmetReason: ld.preferenceUnmetReason,
        selectedProfessionalId: null,
        selectedQuoteId: null,
        createdAt: ld.createdAt,
        updatedAt: ld.updatedAt,
      })),
    );

    await tx.insert(t.leadDomainAssignments).values(
      seed.leadDomainAssignments.map((a) => ({
        id: uid(a.id),
        leadDomainId: uid(a.leadDomainId),
        professionalId: uid(a.professionalId),
        responseStatus: a.responseStatus,
        assignedAt: a.assignedAt,
        respondedAt: a.respondedAt,
        rejectionReason: a.rejectionReason,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
      })),
    );

    await tx.insert(t.leadDomainItems).values(
      seed.leadDomainItems.map((i) => ({
        id: uid(i.id),
        leadDomainId: uid(i.leadDomainId),
        productId: uidOrNull(i.productId),
        packageId: uidOrNull(i.packageId),
        itemName: i.itemName,
        quantity: i.quantity,
        selectedOptions: i.selectedOptions,
        indicativePrice: i.indicativePrice,
        customerNotes: i.customerNotes,
        createdAt: i.createdAt,
        updatedAt: i.updatedAt,
      })),
    );

    await tx.insert(t.leadSalesActivities).values(
      seed.leadSalesActivities.map((a) => ({
        id: uid(a.id),
        leadId: uid(a.leadId),
        salesAgentId: uid(a.salesAgentId),
        callStatus: a.callStatus,
        remarks: a.remarks,
        recordingUrl: a.recordingUrl,
        followUpDate: a.followUpDate,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
      })),
    );

    await tx.insert(t.meetings).values(
      seed.meetings.map((m) => ({
        id: uid(m.id),
        leadDomainId: uid(m.leadDomainId),
        professionalId: uid(m.professionalId),
        type: m.type,
        scheduledAt: m.scheduledAt,
        location: m.location,
        status: m.status,
        notes: m.notes,
        coordinatorId: uidOrNull(m.coordinatorId),
        addressReleasedAt: m.addressReleasedAt,
        rescheduleRequestedAt: m.rescheduleRequestedAt,
        rescheduleNote: m.rescheduleNote,
        outcome: m.outcome,
        outcomeRecordedAt: m.outcomeRecordedAt,
        outcomeChangedScope: m.outcomeChangedScope,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
      })),
    );

    await tx.insert(t.quotes).values(
      seed.quotes.map((q) => ({
        id: uid(q.id),
        leadDomainId: uid(q.leadDomainId),
        professionalId: uid(q.professionalId),
        version: q.version,
        supersedesQuoteId: uidOrNull(q.supersedesQuoteId),
        lineItems: q.lineItems,
        subtotal: q.subtotal,
        taxPercent: q.taxPercent,
        taxAmount: q.taxAmount,
        total: q.total,
        timelineDays: q.timelineDays,
        warrantyMonths: q.warrantyMonths,
        warrantyDetails: q.warrantyDetails,
        materialsSummary: q.materialsSummary,
        boqUrl: q.boqUrl,
        quotePdfUrl: q.quotePdfUrl,
        status: q.status,
        notes: q.notes,
        createdAt: q.createdAt,
        updatedAt: q.updatedAt,
      })),
    );

    // Now that quotes exist, the selections can be made — and the composite
    // foreign key and trigger will check each one really does belong to that
    // service and that vendor.
    for (const ld of seed.leadDomains) {
      if (!ld.selectedQuoteId && !ld.selectedProfessionalId) continue;
      await tx
        .update(t.leadDomains)
        .set({
          selectedProfessionalId: uidOrNull(ld.selectedProfessionalId),
          selectedQuoteId: uidOrNull(ld.selectedQuoteId),
        })
        .where(eq(t.leadDomains.id, uid(ld.id)));
    }

    await tx.insert(t.messages).values(
      seed.messages.map((m) => ({
        id: uid(m.id),
        leadDomainId: uid(m.leadDomainId),
        channel: m.channel,
        senderRole: m.senderRole,
        senderId: uid(m.senderId),
        professionalId: uidOrNull(m.professionalId),
        body: m.body,
        attachmentUrl: m.attachmentUrl,
        readAt: m.readAt,
        relayedFromMessageId: uidOrNull(m.relayedFromMessageId),
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
      })),
    );

    /* ---------------- contracts and delivery ---------------- */

    await tx.insert(t.agreements).values(
      seed.agreements.map((a) => ({
        id: uid(a.id),
        reference: a.reference,
        leadId: uid(a.leadId),
        clientId: uid(a.clientId),
        professionalId: uid(a.professionalId),
        totalValue: a.totalValue,
        paymentTerms: a.paymentTerms,
        status: a.status,
        documentUrl: a.documentUrl,
        sentAt: a.sentAt,
        signedAt: a.signedAt,
        startDate: a.startDate,
        cancelledReason: a.cancelledReason,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
      })),
    );

    await tx.insert(t.agreementLeadDomains).values(
      seed.agreementLeadDomains.map((l) => ({
        id: uid(l.id),
        agreementId: uid(l.agreementId),
        leadDomainId: uid(l.leadDomainId),
        quoteId: uid(l.quoteId),
        value: l.value,
        createdAt: l.createdAt,
        updatedAt: l.updatedAt,
      })),
    );

    await tx.insert(t.partnerAgreements).values(
      seed.partnerAgreements.map((a) => ({
        id: uid(a.id),
        professionalId: uid(a.professionalId),
        termsVersion: a.termsVersion,
        status: a.status,
        signatureText: a.signatureText,
        signatoryName: a.signatoryName,
        signatoryRole: a.signatoryRole,
        signedAt: a.signedAt,
        acknowledgedClauses: a.acknowledgedClauses,
        signedFromIp: a.signedFromIp,
        signedUserAgent: a.signedUserAgent,
        documentUrl: a.documentUrl,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
      })),
    );

    await tx.insert(t.projects).values(
      seed.projects.map((p) => ({
        id: uid(p.id),
        reference: p.reference,
        leadDomainId: uid(p.leadDomainId),
        agreementId: uid(p.agreementId),
        clientId: uid(p.clientId),
        professionalId: uid(p.professionalId),
        quoteId: uid(p.quoteId),
        value: p.value,
        commissionPercent: p.commissionPercent,
        commissionAmount: p.commissionAmount,
        startDate: p.startDate,
        estimatedEndDate: p.estimatedEndDate,
        actualEndDate: p.actualEndDate,
        completionPercent: p.completionPercent,
        status: p.status,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
    );

    // Milestones were an embedded array; here they are rows, because ops and
    // the vendor write to them independently.
    const milestones = seed.projects.flatMap((p) =>
      p.milestones.map((m, index) => ({
        id: uid(m.id),
        projectId: uid(p.id),
        sortOrder: index,
        title: m.title,
        description: m.description,
        completedAt: m.completedAt,
        proofNote: m.proofNote,
        submittedAt: m.submittedAt,
        verification: m.verification,
        verifiedAt: m.verifiedAt,
        verifiedByUserId: uidOrNull(m.verifiedByUserId),
        verifierNote: m.verifierNote,
      })),
    );
    if (milestones.length > 0) await tx.insert(t.projectMilestones).values(milestones);

    await tx.insert(t.commissionInvoices).values(
      seed.commissionInvoices.map((i) => ({
        id: uid(i.id),
        reference: i.reference,
        professionalId: uid(i.professionalId),
        agreementId: uid(i.agreementId),
        amount: i.amount,
        status: i.status,
        dueDate: i.dueDate,
        paidDate: i.paidDate,
        adjustmentNote: i.adjustmentNote,
        createdAt: i.createdAt,
        updatedAt: i.updatedAt,
      })),
    );

    await tx.insert(t.reviews).values(
      seed.reviews.map((r) => ({
        id: uid(r.id),
        projectId: uid(r.projectId),
        clientId: uid(r.clientId),
        professionalId: uid(r.professionalId),
        domainId: uid(r.domainId),
        rating: r.rating,
        comment: r.comment,
        qualityRating: r.qualityRating,
        timelinessRating: r.timelinessRating,
        professionalismRating: r.professionalismRating,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
    );

    /* ---------------- support and notifications ---------------- */

    await tx.insert(t.supportTickets).values(
      seed.supportTickets.map((s) => ({
        id: uid(s.id),
        reference: s.reference,
        raisedByUserId: uid(s.raisedByUserId),
        leadId: uidOrNull(s.leadId),
        projectId: uidOrNull(s.projectId),
        category: s.category,
        subject: s.subject,
        body: s.body,
        priority: s.priority,
        status: s.status,
        assignedToUserId: uidOrNull(s.assignedToUserId),
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      })),
    );

    const replies = seed.supportTickets.flatMap((s) =>
      s.replies.map((r) => ({
        id: uid(r.id),
        ticketId: uid(s.id),
        authorRole: r.authorRole,
        authorUserId: null,
        authorName: r.authorName,
        body: r.body,
        createdAt: r.createdAt,
      })),
    );
    if (replies.length > 0) await tx.insert(t.ticketReplies).values(replies);

    await tx.insert(t.notifications).values(
      seed.notifications.map((n) => ({
        id: uid(n.id),
        userId: uid(n.userId),
        type: n.type,
        title: n.title,
        body: n.body,
        entityType: n.entityType,
        entityId: uidOrNull(n.entityId),
        isRead: n.isRead,
        // Seed notifications are historical, so nothing is queued for sending.
        dispatchedAt: n.createdAt,
        createdAt: n.createdAt,
        updatedAt: n.updatedAt,
      })),
    );

    /* ---------------- media ---------------- */

    // The mock carries media inline on its owners; here it is one table, so the
    // arrays are flattened into rows. Seed URLs are "ph:" placeholder tokens
    // rather than files — the Media component renders those as designed tiles,
    // which is what keeps the catalogue looking like a catalogue with no
    // photography in the repository.
    type MediaSeed = {
      id: string;
      url: string;
      type: "photo" | "video" | "document";
      caption?: string;
    };

    const mediaRows: Array<typeof t.mediaAssets.$inferInsert> = [];

    const collect = (
      ownerType: string,
      ownerId: string,
      purpose: (typeof t.mediaAssets.$inferInsert)["purpose"],
      assets: readonly MediaSeed[],
    ) => {
      assets.forEach((asset, index) => {
        mediaRows.push({
          id: uid(asset.id),
          purpose,
          type: asset.type,
          storageKey: asset.url,
          contentType: asset.type === "document" ? "application/pdf" : "image/jpeg",
          sizeBytes: 0,
          caption: asset.caption ?? null,
          // Seeded media is already in place, so it is confirmed — an
          // unconfirmed row means a ticket that was issued and never used, and
          // the orphan sweep would delete these.
          confirmedAt: new Date().toISOString(),
          ownerType,
          ownerId: uid(ownerId),
          sortOrder: index,
        });
      });
    };

    for (const p of seed.products) collect("product", p.id, "catalogue_image", p.media);
    for (const p of seed.servicePackages) collect("service_package", p.id, "catalogue_image", p.media);
    for (const p of seed.portfolioItems) collect("portfolio_item", p.id, "portfolio_item", p.media);
    for (const l of seed.leads) collect("lead", l.id, "requirement_photo", l.photos);
    for (const p of seed.projects) {
      for (const m of p.milestones) collect("project_milestone", m.id, "milestone_proof", m.proof);
    }

    if (mediaRows.length > 0) await tx.insert(t.mediaAssets).values(mediaRows);

    await tx.insert(t.referrals).values(
      seed.referrals.map((r) => ({
        id: uid(r.id),
        referrerUserId: uid(r.referrerUserId),
        referredUserId: uid(r.referredUserId),
        rewardStatus: r.rewardStatus,
        rewardAmount: r.rewardAmount,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
    );

    /* ---------------- staff sign-in ---------------- */

    // Ops and admin accounts need a password to sign in with, and the seed is
    // the only place that knows one. Refused outside development: a known
    // password on an account that can read every customer's phone number is
    // not something to leave lying in a deployed database.
    if (process.env.NODE_ENV === "production") {
      console.log("  (skipping staff passwords — not development)");
    } else {
      const devPassword = process.env.SEED_STAFF_PASSWORD ?? "aangan-dev-password";
      const passwordHash = await argon2.hash(devPassword, { type: argon2.argon2id });

      const staff = seed.users.filter((u) => u.role === "admin" || u.role === "sales_agent");
      if (staff.length > 0) {
        await tx.insert(t.staffCredentials).values(
          staff.map((u) => ({ userId: uid(u.id), passwordHash })),
        );
      }
      staffEmails = staff.map((u) => u.email).filter((e): e is string => Boolean(e));
      staffPassword = devPassword;
    }

    // Reference sequences must start above the highest seeded number, or the
    // first real lead collides with a demo one.
    await tx.execute(raw`SELECT setval('lead_reference_seq', ${1062 + seed.leads.length})`);
    await tx.execute(raw`SELECT setval('project_reference_seq', ${500 + seed.projects.length})`);
    await tx.execute(
      raw`SELECT setval('invoice_reference_seq', ${500 + seed.commissionInvoices.length})`,
    );
    await tx.execute(raw`SELECT setval('ticket_reference_seq', ${200 + seed.supportTickets.length})`);
  });

  console.log(`Seeded in ${Date.now() - started}ms`);
  // Worth knowing when comparing this against the frontend's seed data: the
  // triggers in 0002_invariants.sql run during the load, so any value that is
  // *derived* is recomputed from the rows underneath it rather than taken from
  // the seed. Project completion now follows approved milestones, and a
  // vendor's rating follows the reviews that actually exist — the mock carries
  // two reviews but hand-written rating counts in the dozens, so one vendor's
  // review count drops. That is the derivation working, not the seed breaking.
  console.log(`  ${seed.cities.length} cities, ${seed.domains.length} domains`);
  console.log(`  ${seed.users.length} users (${seed.professionals.length} professionals)`);
  console.log(`  ${seed.products.length} products, ${seed.servicePackages.length} packages`);
  console.log(`  ${seed.leads.length} leads, ${seed.leadDomains.length} services`);
  console.log(`  ${seed.projects.length} projects, ${seed.blogPosts.length} posts`);
  if (staffEmails.length > 0) {
    console.log(`
  Staff sign-in (development only): ${staffEmails.join(", ")}`);
    console.log(`  Password: ${staffPassword}`);
    console.log(`  Customers and vendors sign in by mobile — OTP_DEV_ECHO returns the code.`);
  }
}

main()
  .then(async () => {
    await closeDatabase();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("Seed failed:", error);
    await closeDatabase().catch(() => {});
    process.exit(1);
  });
