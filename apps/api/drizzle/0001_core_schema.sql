CREATE TYPE "public"."agreement_status" AS ENUM('draft', 'sent', 'signed', 'active', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."assignment_response" AS ENUM('pending', 'accepted', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."call_status" AS ENUM('connected', 'not_reachable', 'busy', 'callback_requested', 'not_interested');--> statement-breakpoint
CREATE TYPE "public"."device_platform" AS ENUM('android', 'ios', 'web');--> statement-breakpoint
CREATE TYPE "public"."domain_approval_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('pending', 'paid', 'overdue', 'waived', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."lead_domain_status" AS ENUM('pending_assignment', 'assigned', 'quoted', 'vendor_selected', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."lead_source" AS ENUM('app', 'website', 'referral', 'sales_call', 'catalogue');--> statement-breakpoint
CREATE TYPE "public"."lead_status" AS ENUM('new', 'verified', 'in_progress', 'closed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."material_source" AS ENUM('vendor_supplied', 'customer_supplied', 'undecided');--> statement-breakpoint
CREATE TYPE "public"."media_type" AS ENUM('photo', 'video', 'document');--> statement-breakpoint
CREATE TYPE "public"."meeting_status" AS ENUM('scheduled', 'confirmed', 'completed', 'rescheduled', 'no_show');--> statement-breakpoint
CREATE TYPE "public"."meeting_type" AS ENUM('consultation', 'site_visit', 'measurement', 'handover');--> statement-breakpoint
CREATE TYPE "public"."message_channel" AS ENUM('client_platform', 'platform_vendor');--> statement-breakpoint
CREATE TYPE "public"."message_sender_role" AS ENUM('client', 'platform', 'professional');--> statement-breakpoint
CREATE TYPE "public"."milestone_verification" AS ENUM('not_started', 'submitted', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."moderation_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."notification_entity" AS ENUM('lead', 'lead_domain', 'quote', 'meeting', 'agreement', 'project', 'invoice', 'message');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('professional_assigned', 'meeting_confirmed', 'quote_uploaded', 'agreement_ready', 'agreement_signed', 'project_started', 'project_completed', 'new_lead', 'commission_due', 'message_received', 'review_received');--> statement-breakpoint
CREATE TYPE "public"."partner_agreement_status" AS ENUM('pending', 'signed', 'superseded', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."post_status" AS ENUM('draft', 'scheduled', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."price_unit" AS ENUM('per_piece', 'per_sqft', 'per_running_ft', 'per_kg', 'per_room', 'per_project');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('not_started', 'ongoing', 'on_hold', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."quote_status" AS ENUM('draft', 'submitted', 'revised', 'approved', 'rejected', 'selected');--> statement-breakpoint
CREATE TYPE "public"."referral_reward_status" AS ENUM('pending', 'earned', 'paid', 'expired');--> statement-breakpoint
CREATE TYPE "public"."refund_status" AS ENUM('requested', 'approved', 'rejected', 'processed');--> statement-breakpoint
CREATE TYPE "public"."ticket_author_role" AS ENUM('client', 'platform');--> statement-breakpoint
CREATE TYPE "public"."ticket_category" AS ENUM('complaint', 'escalation', 'refund', 'query', 'technical');--> statement-breakpoint
CREATE TYPE "public"."ticket_priority" AS ENUM('low', 'medium', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('open', 'in_progress', 'resolved', 'closed');--> statement-breakpoint
CREATE TYPE "public"."upload_purpose" AS ENUM('requirement_photo', 'milestone_proof', 'portfolio_item', 'vendor_document', 'catalogue_image', 'blog_image');--> statement-breakpoint
CREATE TYPE "public"."urgency" AS ENUM('immediate', 'within_month', 'exploring');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('client', 'professional', 'sales_agent', 'admin');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'inactive', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('pending', 'verified', 'suspended', 'blacklisted');--> statement-breakpoint
CREATE TABLE "cities" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"name" text NOT NULL,
	"slug" varchar(80) NOT NULL,
	"state" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_roles" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "admin_users" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"actor_user_id" uuid,
	"action" varchar(80) NOT NULL,
	"entity_type" varchar(40) NOT NULL,
	"entity_id" uuid,
	"summary" text NOT NULL,
	"changes" jsonb,
	"ip" varchar(45),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"user_id" uuid NOT NULL,
	"address" text,
	"referral_code" varchar(24) NOT NULL,
	"referred_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "device_tokens" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"platform" "device_platform" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "otp_challenges" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"mobile" varchar(20) NOT NULL,
	"code_hash" text NOT NULL,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"ip" varchar(45),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "professionals" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"user_id" uuid NOT NULL,
	"company_name" text NOT NULL,
	"gst_number" varchar(20),
	"experience_years" integer DEFAULT 0 NOT NULL,
	"bio" text DEFAULT '' NOT NULL,
	"avg_rating_x10" integer DEFAULT 0 NOT NULL,
	"rating_count" integer DEFAULT 0 NOT NULL,
	"completed_projects" integer DEFAULT 0 NOT NULL,
	"languages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"verification_status" "verification_status" DEFAULT 'pending' NOT NULL,
	"avg_response_hours" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" varchar(200) PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"window_started_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referrals" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"referrer_user_id" uuid NOT NULL,
	"referred_user_id" uuid NOT NULL,
	"reward_status" "referral_reward_status" DEFAULT 'pending' NOT NULL,
	"reward_amount" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sales_agents" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"user_id" uuid NOT NULL,
	"assigned_city_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"daily_target" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_agent" text,
	"ip" varchar(45),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "staff_credentials" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"user_id" uuid NOT NULL,
	"password_hash" text NOT NULL,
	"totp_secret" text,
	"totp_confirmed_at" timestamp with time zone,
	"failed_attempts" smallint DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"password_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"name" text NOT NULL,
	"mobile" varchar(20) NOT NULL,
	"email" text,
	"role" "user_role" NOT NULL,
	"city_id" uuid NOT NULL,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "domains" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"name" text NOT NULL,
	"slug" varchar(80) NOT NULL,
	"tagline" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"icon_key" varchar(40) NOT NULL,
	"banner_url" text,
	"default_commission_percent" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"labels" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "portfolio_items" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"professional_id" uuid NOT NULL,
	"domain_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"moderation_status" "moderation_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "professional_domains" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"professional_id" uuid NOT NULL,
	"domain_id" uuid NOT NULL,
	"verification_status" "domain_approval_status" DEFAULT 'pending' NOT NULL,
	"commission_percent_override" integer,
	"avg_rating_x10" integer DEFAULT 0 NOT NULL,
	"rating_count" integer DEFAULT 0 NOT NULL,
	"completed_projects" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "professional_service_areas" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"professional_id" uuid NOT NULL,
	"city_id" uuid NOT NULL,
	"localities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "package_items" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"package_id" uuid NOT NULL,
	"product_id" uuid,
	"label" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "product_categories" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"domain_id" uuid NOT NULL,
	"parent_id" uuid,
	"name" text NOT NULL,
	"slug" varchar(120) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"image_url" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "product_city_prices" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"product_id" uuid NOT NULL,
	"city_id" uuid NOT NULL,
	"price" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"domain_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" varchar(160) NOT NULL,
	"short_description" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"base_price" integer NOT NULL,
	"price_unit" "price_unit" NOT NULL,
	"lead_time_days" integer DEFAULT 0 NOT NULL,
	"is_customisable" boolean DEFAULT true NOT NULL,
	"specs" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"rating_x10" integer DEFAULT 0 NOT NULL,
	"rating_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "saved_items" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"client_id" uuid NOT NULL,
	"product_id" uuid,
	"package_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "service_packages" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"domain_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" varchar(160) NOT NULL,
	"short_description" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"price" integer NOT NULL,
	"price_basis" text NOT NULL,
	"duration_days" integer DEFAULT 0 NOT NULL,
	"inclusions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"exclusions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"badge" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "banners" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"title" text NOT NULL,
	"subtitle" text DEFAULT '' NOT NULL,
	"image_url" text DEFAULT '' NOT NULL,
	"cta_label" text DEFAULT '' NOT NULL,
	"cta_href" text DEFAULT '' NOT NULL,
	"domain_id" uuid,
	"city_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "blog_categories" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"name" text NOT NULL,
	"slug" varchar(120) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "blog_post_tags" (
	"post_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blog_posts" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"title" text NOT NULL,
	"slug" varchar(200) NOT NULL,
	"excerpt" text DEFAULT '' NOT NULL,
	"body" text NOT NULL,
	"cover_image_url" text DEFAULT '' NOT NULL,
	"author_name" text NOT NULL,
	"author_role" text DEFAULT '' NOT NULL,
	"category_id" uuid NOT NULL,
	"domain_id" uuid,
	"status" "post_status" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"reading_minutes" integer DEFAULT 1 NOT NULL,
	"seo_title" text NOT NULL,
	"seo_description" text NOT NULL,
	"og_image_url" text,
	"is_featured" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "blog_tags" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"name" text NOT NULL,
	"slug" varchar(120) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "testimonials" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"client_name" text NOT NULL,
	"city_name" text DEFAULT '' NOT NULL,
	"domain_id" uuid NOT NULL,
	"rating" integer DEFAULT 5 NOT NULL,
	"quote" text NOT NULL,
	"avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "lead_domain_assignments" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"lead_domain_id" uuid NOT NULL,
	"professional_id" uuid NOT NULL,
	"response_status" "assignment_response" DEFAULT 'pending' NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"responded_at" timestamp with time zone,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "lead_domain_items" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"lead_domain_id" uuid NOT NULL,
	"product_id" uuid,
	"package_id" uuid,
	"item_name" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"selected_options" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"indicative_price" integer,
	"customer_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "lead_domains" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"lead_id" uuid NOT NULL,
	"domain_id" uuid NOT NULL,
	"material_source" "material_source" DEFAULT 'undecided' NOT NULL,
	"status" "lead_domain_status" DEFAULT 'pending_assignment' NOT NULL,
	"preferred_professional_id" uuid,
	"preference_unmet_reason" text,
	"selected_professional_id" uuid,
	"selected_quote_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "lead_sales_activities" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"lead_id" uuid NOT NULL,
	"sales_agent_id" uuid NOT NULL,
	"call_status" "call_status" NOT NULL,
	"remarks" text DEFAULT '' NOT NULL,
	"recording_url" text,
	"follow_up_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"reference" varchar(24) NOT NULL,
	"client_id" uuid NOT NULL,
	"city_id" uuid NOT NULL,
	"description" text NOT NULL,
	"urgency" "urgency" NOT NULL,
	"budget_min" integer,
	"budget_max" integer,
	"site_accessibility_tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source" "lead_source" DEFAULT 'app' NOT NULL,
	"overall_status" "lead_status" DEFAULT 'new' NOT NULL,
	"assigned_sales_agent_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "meetings" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"lead_domain_id" uuid NOT NULL,
	"professional_id" uuid NOT NULL,
	"type" "meeting_type" NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"location" text NOT NULL,
	"status" "meeting_status" DEFAULT 'scheduled' NOT NULL,
	"notes" text,
	"coordinator_id" uuid,
	"address_released_at" timestamp with time zone,
	"reschedule_requested_at" timestamp with time zone,
	"reschedule_note" text,
	"outcome" text,
	"outcome_recorded_at" timestamp with time zone,
	"outcome_changed_scope" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"lead_domain_id" uuid NOT NULL,
	"channel" "message_channel" NOT NULL,
	"sender_role" "message_sender_role" NOT NULL,
	"sender_id" uuid NOT NULL,
	"professional_id" uuid,
	"body" text NOT NULL,
	"attachment_url" text,
	"read_at" timestamp with time zone,
	"relayed_from_message_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "ck_message_channel" CHECK (("messages"."channel" = 'client_platform' AND "messages"."professional_id" IS NULL AND "messages"."sender_role" IN ('client', 'platform'))
       OR ("messages"."channel" = 'platform_vendor' AND "messages"."professional_id" IS NOT NULL AND "messages"."sender_role" IN ('professional', 'platform')))
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"lead_domain_id" uuid NOT NULL,
	"professional_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"supersedes_quote_id" uuid,
	"line_items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"subtotal" integer NOT NULL,
	"tax_percent" integer DEFAULT 0 NOT NULL,
	"tax_amount" integer DEFAULT 0 NOT NULL,
	"total" integer NOT NULL,
	"timeline_days" integer NOT NULL,
	"warranty_months" integer DEFAULT 0 NOT NULL,
	"warranty_details" text DEFAULT '' NOT NULL,
	"materials_summary" text DEFAULT '' NOT NULL,
	"boq_url" text,
	"quote_pdf_url" text,
	"status" "quote_status" DEFAULT 'submitted' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "agreement_lead_domains" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"agreement_id" uuid NOT NULL,
	"lead_domain_id" uuid NOT NULL,
	"quote_id" uuid NOT NULL,
	"value" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "agreements" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"reference" varchar(32) NOT NULL,
	"lead_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"professional_id" uuid NOT NULL,
	"total_value" integer NOT NULL,
	"payment_terms" text DEFAULT '' NOT NULL,
	"status" "agreement_status" DEFAULT 'draft' NOT NULL,
	"document_url" text,
	"sent_at" timestamp with time zone,
	"signed_at" timestamp with time zone,
	"start_date" date,
	"cancelled_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "partner_agreements" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"professional_id" uuid NOT NULL,
	"terms_version" varchar(20) NOT NULL,
	"status" "partner_agreement_status" DEFAULT 'pending' NOT NULL,
	"signature_text" text,
	"signatory_name" text,
	"signatory_role" text,
	"signed_at" timestamp with time zone,
	"acknowledged_clauses" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"signed_from_ip" varchar(45),
	"signed_user_agent" text,
	"document_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "partner_terms" (
	"version" varchar(20) PRIMARY KEY NOT NULL,
	"effective_from" date NOT NULL,
	"title" text NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"sections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"acknowledgements" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_current" boolean,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "commission_invoices" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"reference" varchar(32) NOT NULL,
	"professional_id" uuid NOT NULL,
	"agreement_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"status" "invoice_status" DEFAULT 'pending' NOT NULL,
	"due_date" date NOT NULL,
	"paid_date" date,
	"adjustment_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "project_milestones" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"project_id" uuid NOT NULL,
	"sort_order" smallint NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"completed_at" timestamp with time zone,
	"proof_note" text,
	"submitted_at" timestamp with time zone,
	"verification" "milestone_verification" DEFAULT 'not_started' NOT NULL,
	"verified_at" timestamp with time zone,
	"verified_by_user_id" uuid,
	"verifier_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"reference" varchar(40) NOT NULL,
	"lead_domain_id" uuid NOT NULL,
	"agreement_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"professional_id" uuid NOT NULL,
	"quote_id" uuid NOT NULL,
	"value" integer NOT NULL,
	"commission_percent" integer NOT NULL,
	"commission_amount" integer NOT NULL,
	"start_date" date,
	"estimated_end_date" date,
	"actual_end_date" date,
	"completion_percent" smallint DEFAULT 0 NOT NULL,
	"status" "project_status" DEFAULT 'not_started' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "refunds" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"project_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"reason" text NOT NULL,
	"status" "refund_status" DEFAULT 'requested' NOT NULL,
	"processed_at" timestamp with time zone,
	"handled_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"project_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"professional_id" uuid NOT NULL,
	"domain_id" uuid NOT NULL,
	"rating" smallint NOT NULL,
	"comment" text DEFAULT '' NOT NULL,
	"quality_rating" smallint,
	"timeliness_rating" smallint,
	"professionalism_rating" smallint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "ck_review_rating" CHECK ("reviews"."rating" BETWEEN 1 AND 5)
);
--> statement-breakpoint
CREATE TABLE "support_tickets" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"reference" varchar(32) NOT NULL,
	"raised_by_user_id" uuid NOT NULL,
	"lead_id" uuid,
	"project_id" uuid,
	"category" "ticket_category" NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"priority" "ticket_priority" DEFAULT 'medium' NOT NULL,
	"status" "ticket_status" DEFAULT 'open' NOT NULL,
	"assigned_to_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ticket_replies" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"author_role" "ticket_author_role" NOT NULL,
	"author_user_id" uuid,
	"author_name" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_assets" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"purpose" "upload_purpose" NOT NULL,
	"type" "media_type" NOT NULL,
	"storage_key" text NOT NULL,
	"content_type" varchar(100) NOT NULL,
	"size_bytes" integer NOT NULL,
	"caption" text,
	"uploaded_by_user_id" uuid,
	"confirmed_at" timestamp with time zone,
	"owner_type" varchar(40),
	"owner_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "notification_type" NOT NULL,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"entity_type" "notification_entity",
	"entity_id" uuid,
	"is_read" boolean DEFAULT false NOT NULL,
	"dispatched_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_role_id_admin_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."admin_roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_referred_by_user_id_users_id_fk" FOREIGN KEY ("referred_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_tokens" ADD CONSTRAINT "device_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professionals" ADD CONSTRAINT "professionals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrer_user_id_users_id_fk" FOREIGN KEY ("referrer_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referred_user_id_users_id_fk" FOREIGN KEY ("referred_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_agents" ADD CONSTRAINT "sales_agents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_credentials" ADD CONSTRAINT "staff_credentials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_items" ADD CONSTRAINT "portfolio_items_professional_id_professionals_id_fk" FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_items" ADD CONSTRAINT "portfolio_items_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professional_domains" ADD CONSTRAINT "professional_domains_professional_id_professionals_id_fk" FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professional_domains" ADD CONSTRAINT "professional_domains_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professional_service_areas" ADD CONSTRAINT "professional_service_areas_professional_id_professionals_id_fk" FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professional_service_areas" ADD CONSTRAINT "professional_service_areas_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_items" ADD CONSTRAINT "package_items_package_id_service_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."service_packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_items" ADD CONSTRAINT "package_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_city_prices" ADD CONSTRAINT "product_city_prices_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_city_prices" ADD CONSTRAINT "product_city_prices_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_product_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."product_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_items" ADD CONSTRAINT "saved_items_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_items" ADD CONSTRAINT "saved_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_items" ADD CONSTRAINT "saved_items_package_id_service_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."service_packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_packages" ADD CONSTRAINT "service_packages_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "banners" ADD CONSTRAINT "banners_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_post_tags" ADD CONSTRAINT "blog_post_tags_post_id_blog_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."blog_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_post_tags" ADD CONSTRAINT "blog_post_tags_tag_id_blog_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."blog_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_category_id_blog_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."blog_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "testimonials" ADD CONSTRAINT "testimonials_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_domain_assignments" ADD CONSTRAINT "lead_domain_assignments_lead_domain_id_lead_domains_id_fk" FOREIGN KEY ("lead_domain_id") REFERENCES "public"."lead_domains"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_domain_assignments" ADD CONSTRAINT "lead_domain_assignments_professional_id_professionals_id_fk" FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_domain_items" ADD CONSTRAINT "lead_domain_items_lead_domain_id_lead_domains_id_fk" FOREIGN KEY ("lead_domain_id") REFERENCES "public"."lead_domains"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_domain_items" ADD CONSTRAINT "lead_domain_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_domain_items" ADD CONSTRAINT "lead_domain_items_package_id_service_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."service_packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_domains" ADD CONSTRAINT "lead_domains_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_domains" ADD CONSTRAINT "lead_domains_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_domains" ADD CONSTRAINT "lead_domains_preferred_professional_id_professionals_id_fk" FOREIGN KEY ("preferred_professional_id") REFERENCES "public"."professionals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_domains" ADD CONSTRAINT "lead_domains_selected_professional_id_professionals_id_fk" FOREIGN KEY ("selected_professional_id") REFERENCES "public"."professionals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_sales_activities" ADD CONSTRAINT "lead_sales_activities_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_sales_activities" ADD CONSTRAINT "lead_sales_activities_sales_agent_id_sales_agents_id_fk" FOREIGN KEY ("sales_agent_id") REFERENCES "public"."sales_agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_assigned_sales_agent_id_sales_agents_id_fk" FOREIGN KEY ("assigned_sales_agent_id") REFERENCES "public"."sales_agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_lead_domain_id_lead_domains_id_fk" FOREIGN KEY ("lead_domain_id") REFERENCES "public"."lead_domains"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_professional_id_professionals_id_fk" FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_coordinator_id_sales_agents_id_fk" FOREIGN KEY ("coordinator_id") REFERENCES "public"."sales_agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_lead_domain_id_lead_domains_id_fk" FOREIGN KEY ("lead_domain_id") REFERENCES "public"."lead_domains"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_professional_id_professionals_id_fk" FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_lead_domain_id_lead_domains_id_fk" FOREIGN KEY ("lead_domain_id") REFERENCES "public"."lead_domains"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_professional_id_professionals_id_fk" FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement_lead_domains" ADD CONSTRAINT "agreement_lead_domains_agreement_id_agreements_id_fk" FOREIGN KEY ("agreement_id") REFERENCES "public"."agreements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement_lead_domains" ADD CONSTRAINT "agreement_lead_domains_lead_domain_id_lead_domains_id_fk" FOREIGN KEY ("lead_domain_id") REFERENCES "public"."lead_domains"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement_lead_domains" ADD CONSTRAINT "agreement_lead_domains_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreements" ADD CONSTRAINT "agreements_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreements" ADD CONSTRAINT "agreements_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreements" ADD CONSTRAINT "agreements_professional_id_professionals_id_fk" FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_agreements" ADD CONSTRAINT "partner_agreements_professional_id_professionals_id_fk" FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_agreements" ADD CONSTRAINT "partner_agreements_terms_version_partner_terms_version_fk" FOREIGN KEY ("terms_version") REFERENCES "public"."partner_terms"("version") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_invoices" ADD CONSTRAINT "commission_invoices_professional_id_professionals_id_fk" FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_invoices" ADD CONSTRAINT "commission_invoices_agreement_id_agreements_id_fk" FOREIGN KEY ("agreement_id") REFERENCES "public"."agreements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_milestones" ADD CONSTRAINT "project_milestones_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_milestones" ADD CONSTRAINT "project_milestones_verified_by_user_id_users_id_fk" FOREIGN KEY ("verified_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_lead_domain_id_lead_domains_id_fk" FOREIGN KEY ("lead_domain_id") REFERENCES "public"."lead_domains"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_agreement_id_agreements_id_fk" FOREIGN KEY ("agreement_id") REFERENCES "public"."agreements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_professional_id_professionals_id_fk" FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_handled_by_user_id_users_id_fk" FOREIGN KEY ("handled_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_professional_id_professionals_id_fk" FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_raised_by_user_id_users_id_fk" FOREIGN KEY ("raised_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_assigned_to_user_id_users_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_replies" ADD CONSTRAINT "ticket_replies_ticket_id_support_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_replies" ADD CONSTRAINT "ticket_replies_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_cities_slug" ON "cities" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_admin_users_user" ON "admin_users" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ix_audit_entity" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "ix_audit_actor" ON "audit_logs" USING btree ("actor_user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_clients_user" ON "clients" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_clients_referral_code" ON "clients" USING btree ("referral_code");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_device_token" ON "device_tokens" USING btree ("token");--> statement-breakpoint
CREATE INDEX "ix_otp_mobile_created" ON "otp_challenges" USING btree ("mobile","created_at");--> statement-breakpoint
CREATE INDEX "ix_otp_expiry" ON "otp_challenges" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_professionals_user" ON "professionals" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ix_professionals_verification" ON "professionals" USING btree ("verification_status");--> statement-breakpoint
CREATE INDEX "ix_rate_limits_window" ON "rate_limits" USING btree ("window_started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_referral_referred" ON "referrals" USING btree ("referred_user_id");--> statement-breakpoint
CREATE INDEX "ix_referral_referrer" ON "referrals" USING btree ("referrer_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_sales_agents_user" ON "sales_agents" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_sessions_token" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "ix_sessions_user" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ix_sessions_expiry" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_staff_credentials_user" ON "staff_credentials" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_users_mobile" ON "users" USING btree ("mobile") WHERE "users"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_users_email" ON "users" USING btree ("email") WHERE "users"."deleted_at" IS NULL AND "users"."email" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "ix_users_role" ON "users" USING btree ("role");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_domains_slug" ON "domains" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "ix_portfolio_professional" ON "portfolio_items" USING btree ("professional_id");--> statement-breakpoint
CREATE INDEX "ix_portfolio_public" ON "portfolio_items" USING btree ("domain_id","moderation_status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_professional_domain" ON "professional_domains" USING btree ("professional_id","domain_id");--> statement-breakpoint
CREATE INDEX "ix_professional_domain_lookup" ON "professional_domains" USING btree ("domain_id","verification_status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_service_area" ON "professional_service_areas" USING btree ("professional_id","city_id");--> statement-breakpoint
CREATE INDEX "ix_service_area_city" ON "professional_service_areas" USING btree ("city_id");--> statement-breakpoint
CREATE INDEX "ix_package_item_package" ON "package_items" USING btree ("package_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_product_category_slug" ON "product_categories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "ix_product_category_domain" ON "product_categories" USING btree ("domain_id","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_product_city_price" ON "product_city_prices" USING btree ("product_id","city_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_product_slug" ON "products" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "ix_product_domain" ON "products" USING btree ("domain_id","is_active");--> statement-breakpoint
CREATE INDEX "ix_product_category" ON "products" USING btree ("category_id","is_active");--> statement-breakpoint
CREATE INDEX "ix_product_featured" ON "products" USING btree ("is_featured","rating_x10");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_saved_product" ON "saved_items" USING btree ("client_id","product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_saved_package" ON "saved_items" USING btree ("client_id","package_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_package_slug" ON "service_packages" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "ix_package_domain" ON "service_packages" USING btree ("domain_id","is_active");--> statement-breakpoint
CREATE INDEX "ix_banner_active" ON "banners" USING btree ("is_active","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_blog_category_slug" ON "blog_categories" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_blog_post_tag" ON "blog_post_tags" USING btree ("post_id","tag_id");--> statement-breakpoint
CREATE INDEX "ix_blog_post_tag_tag" ON "blog_post_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_blog_post_slug" ON "blog_posts" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "ix_blog_post_published" ON "blog_posts" USING btree ("status","published_at");--> statement-breakpoint
CREATE INDEX "ix_blog_post_domain" ON "blog_posts" USING btree ("domain_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_blog_tag_slug" ON "blog_tags" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_assignment" ON "lead_domain_assignments" USING btree ("lead_domain_id","professional_id");--> statement-breakpoint
CREATE INDEX "ix_assignment_professional" ON "lead_domain_assignments" USING btree ("professional_id","assigned_at");--> statement-breakpoint
CREATE INDEX "ix_lead_domain_item" ON "lead_domain_items" USING btree ("lead_domain_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_lead_domain" ON "lead_domains" USING btree ("lead_id","domain_id");--> statement-breakpoint
CREATE INDEX "ix_lead_domain_lead" ON "lead_domains" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "ix_lead_domain_queue" ON "lead_domains" USING btree ("status","domain_id");--> statement-breakpoint
CREATE INDEX "ix_lead_domain_selected" ON "lead_domains" USING btree ("selected_professional_id");--> statement-breakpoint
CREATE INDEX "ix_activity_lead" ON "lead_sales_activities" USING btree ("lead_id","created_at");--> statement-breakpoint
CREATE INDEX "ix_activity_followup" ON "lead_sales_activities" USING btree ("follow_up_date") WHERE "lead_sales_activities"."follow_up_date" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_lead_reference" ON "leads" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "ix_lead_client" ON "leads" USING btree ("client_id","created_at");--> statement-breakpoint
CREATE INDEX "ix_lead_queue" ON "leads" USING btree ("overall_status","urgency","created_at");--> statement-breakpoint
CREATE INDEX "ix_lead_agent" ON "leads" USING btree ("assigned_sales_agent_id");--> statement-breakpoint
CREATE INDEX "ix_lead_city" ON "leads" USING btree ("city_id");--> statement-breakpoint
CREATE INDEX "ix_meeting_lead_domain" ON "meetings" USING btree ("lead_domain_id");--> statement-breakpoint
CREATE INDEX "ix_meeting_professional" ON "meetings" USING btree ("professional_id","scheduled_at");--> statement-breakpoint
CREATE INDEX "ix_meeting_schedule" ON "meetings" USING btree ("scheduled_at","status");--> statement-breakpoint
CREATE INDEX "ix_message_thread" ON "messages" USING btree ("lead_domain_id","channel","professional_id","created_at");--> statement-breakpoint
CREATE INDEX "ix_message_unread" ON "messages" USING btree ("lead_domain_id","read_at") WHERE "messages"."read_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_quote_version" ON "quotes" USING btree ("lead_domain_id","professional_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_quote_live" ON "quotes" USING btree ("lead_domain_id","professional_id") WHERE "quotes"."status" NOT IN ('revised', 'rejected');--> statement-breakpoint
CREATE UNIQUE INDEX "uq_quote_id_lead_domain" ON "quotes" USING btree ("id","lead_domain_id");--> statement-breakpoint
CREATE INDEX "ix_quote_lead_domain" ON "quotes" USING btree ("lead_domain_id","total");--> statement-breakpoint
CREATE INDEX "ix_quote_professional" ON "quotes" USING btree ("professional_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_agreement_lead_domain" ON "agreement_lead_domains" USING btree ("lead_domain_id");--> statement-breakpoint
CREATE INDEX "ix_agreement_line_agreement" ON "agreement_lead_domains" USING btree ("agreement_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_agreement_reference" ON "agreements" USING btree ("reference");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_agreement_lead_professional" ON "agreements" USING btree ("lead_id","professional_id") WHERE "agreements"."status" <> 'cancelled';--> statement-breakpoint
CREATE INDEX "ix_agreement_client" ON "agreements" USING btree ("client_id","created_at");--> statement-breakpoint
CREATE INDEX "ix_agreement_professional" ON "agreements" USING btree ("professional_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_partner_agreement_live" ON "partner_agreements" USING btree ("professional_id") WHERE "partner_agreements"."status" <> 'superseded';--> statement-breakpoint
CREATE INDEX "ix_partner_agreement_status" ON "partner_agreements" USING btree ("status","terms_version");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_partner_terms_current" ON "partner_terms" USING btree ("is_current") WHERE "partner_terms"."is_current" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_invoice_reference" ON "commission_invoices" USING btree ("reference");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_invoice_agreement" ON "commission_invoices" USING btree ("agreement_id");--> statement-breakpoint
CREATE INDEX "ix_invoice_professional" ON "commission_invoices" USING btree ("professional_id","status");--> statement-breakpoint
CREATE INDEX "ix_invoice_due" ON "commission_invoices" USING btree ("status","due_date");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_milestone_order" ON "project_milestones" USING btree ("project_id","sort_order");--> statement-breakpoint
CREATE INDEX "ix_milestone_project" ON "project_milestones" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "ix_milestone_submitted" ON "project_milestones" USING btree ("verification","submitted_at") WHERE "project_milestones"."verification" = 'submitted';--> statement-breakpoint
CREATE UNIQUE INDEX "uq_project_reference" ON "projects" USING btree ("reference");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_project_lead_domain" ON "projects" USING btree ("lead_domain_id");--> statement-breakpoint
CREATE INDEX "ix_project_professional" ON "projects" USING btree ("professional_id","status");--> statement-breakpoint
CREATE INDEX "ix_project_client" ON "projects" USING btree ("client_id","created_at");--> statement-breakpoint
CREATE INDEX "ix_project_agreement" ON "projects" USING btree ("agreement_id");--> statement-breakpoint
CREATE INDEX "ix_refund_project" ON "refunds" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_review_project" ON "reviews" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "ix_review_professional" ON "reviews" USING btree ("professional_id","created_at");--> statement-breakpoint
CREATE INDEX "ix_review_professional_domain" ON "reviews" USING btree ("professional_id","domain_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_ticket_reference" ON "support_tickets" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "ix_ticket_raiser" ON "support_tickets" USING btree ("raised_by_user_id","created_at");--> statement-breakpoint
CREATE INDEX "ix_ticket_queue" ON "support_tickets" USING btree ("status","priority","created_at");--> statement-breakpoint
CREATE INDEX "ix_ticket_reply" ON "ticket_replies" USING btree ("ticket_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_media_storage_key" ON "media_assets" USING btree ("storage_key");--> statement-breakpoint
CREATE INDEX "ix_media_owner" ON "media_assets" USING btree ("owner_type","owner_id","sort_order");--> statement-breakpoint
CREATE INDEX "ix_media_orphans" ON "media_assets" USING btree ("confirmed_at","owner_id");--> statement-breakpoint
CREATE INDEX "ix_notification_user" ON "notifications" USING btree ("user_id","is_read","created_at");--> statement-breakpoint
CREATE INDEX "ix_notification_pending" ON "notifications" USING btree ("created_at") WHERE "notifications"."dispatched_at" IS NULL;