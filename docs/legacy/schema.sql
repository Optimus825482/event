-- Legacy schema extracted from backend/seed-data.sql (data rows excluded).
-- Contains only CREATE, ALTER, COMMENT and SET statements.

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;
CREATE EXTENSION IF NOT EXISTS btree_gin WITH SCHEMA public;
COMMENT ON EXTENSION btree_gin IS 'support for indexing common datatypes in GIN';
CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA public;
COMMENT ON EXTENSION pg_stat_statements IS 'track planning and execution statistics of all SQL statements executed';
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;
COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;
COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';
CREATE TYPE public.events_status_enum AS ENUM (
    'draft',
    'published',
    'active',
    'completed',
    'cancelled'
);
CREATE TYPE public.gender_enum AS ENUM (
    'male',
    'female'
);
CREATE TYPE public.guest_notes_notetype_enum AS ENUM (
    'pre_event',
    'during_event',
    'post_event',
    'general'
);
CREATE TYPE public.notifications_priority_enum AS ENUM (
    'low',
    'medium',
    'high',
    'urgent'
);
CREATE TYPE public.notifications_targetrole_enum AS ENUM (
    'all',
    'admin',
    'leader',
    'staff'
);
CREATE TYPE public.notifications_type_enum AS ENUM (
    'event_created',
    'event_updated',
    'event_cancelled',
    'venue_layout_completed',
    'team_organization_completed',
    'review_system_activated',
    'review_system_deactivated',
    'staff_review_completed',
    'staff_review_updated',
    'reservation_system_activated',
    'reservation_system_deactivated',
    'team_assignment_changed',
    'staff_added_to_team',
    'staff_removed_from_team',
    'table_group_changed',
    'new_staff_added',
    'system_announcement'
);
CREATE TYPE public.reservations_status_enum AS ENUM (
    'pending',
    'confirmed',
    'checked_in',
    'cancelled',
    'no_show'
);
CREATE TYPE public.staff_gender_enum AS ENUM (
    'male',
    'female'
);
CREATE TYPE public.staff_performance_reviews_rating_enum AS ENUM (
    'very_bad',
    'bad',
    'average',
    'good',
    'successful',
    'excellent'
);
CREATE TYPE public.staff_status_enum AS ENUM (
    'active',
    'inactive',
    'terminated'
);
CREATE TYPE public.users_role_enum AS ENUM (
    'admin',
    'organizer',
    'staff',
    'venue_owner',
    'leader',
    'controller'
);
CREATE FUNCTION public.gin_compare_prefix_char(character, character, smallint, internal) RETURNS integer
    LANGUAGE c IMMUTABLE STRICT
    AS '$libdir/btree_gin', 'gin_compare_prefix_char';
CREATE FUNCTION public.gin_extract_query_char(character, internal, smallint, internal, internal) RETURNS internal
    LANGUAGE c IMMUTABLE STRICT
    AS '$libdir/btree_gin', 'gin_extract_query_char';
CREATE FUNCTION public.gin_extract_value_char(character, internal) RETURNS internal
    LANGUAGE c IMMUTABLE STRICT
    AS '$libdir/btree_gin', 'gin_extract_value_char';
CREATE FUNCTION public.pg_stat_statements_reset(userid oid DEFAULT 0, dbid oid DEFAULT 0, queryid bigint DEFAULT 0) RETURNS void
    LANGUAGE c STRICT
    AS '$libdir/pg_stat_statements', 'pg_stat_statements_reset_1_7';
SET default_tablespace = '';
SET default_table_access_method = heap;
CREATE TABLE public.customers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "fullName" character varying NOT NULL,
    phone character varying,
    email character varying,
    "vipScore" integer DEFAULT 0 NOT NULL,
    tags text[] DEFAULT '{}'::text[] NOT NULL,
    "isBlacklisted" boolean DEFAULT false NOT NULL,
    notes character varying,
    "totalSpent" integer DEFAULT 0 NOT NULL,
    "eventCount" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(6) without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp(6) without time zone DEFAULT now() NOT NULL,
    "lastEventDate" timestamp(6) without time zone,
    "lastEventId" character varying,
    "totalAttendedEvents" integer DEFAULT 0 NOT NULL,
    "totalReservations" integer DEFAULT 0 NOT NULL,
    "noShowCount" integer DEFAULT 0 NOT NULL
);
CREATE TABLE public.department_locations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "departmentId" uuid NOT NULL,
    "workLocationId" uuid NOT NULL,
    "createdAt" timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE public.department_positions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "departmentId" uuid NOT NULL,
    "positionId" uuid NOT NULL,
    "createdAt" timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE public.departments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    color character varying(50),
    "sortOrder" integer DEFAULT 0,
    "isActive" boolean DEFAULT true,
    "createdAt" timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE public.event_extra_staff (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    full_name character varying(255) NOT NULL,
    "position" character varying(255),
    role character varying(100),
    shift_start character varying(10),
    shift_end character varying(10),
    color character varying(50),
    notes text,
    assigned_groups jsonb,
    assigned_tables jsonb,
    sort_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE public.event_invitations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "eventId" character varying NOT NULL,
    "templateId" uuid,
    "customElements" jsonb,
    size character varying DEFAULT 'A5'::character varying NOT NULL,
    width integer DEFAULT 559 NOT NULL,
    height integer DEFAULT 794 NOT NULL,
    "backgroundColor" character varying,
    "backgroundImage" character varying,
    "eventImages" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "companyLogo" character varying,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(6) without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp(6) without time zone DEFAULT now() NOT NULL,
    "backgroundGradient" character varying
);
CREATE TABLE public.event_staff_assignments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "eventId" uuid NOT NULL,
    "staffId" uuid NOT NULL,
    "tableIds" text[] DEFAULT '{}'::text[] NOT NULL,
    "shiftId" uuid,
    "teamId" uuid,
    color character varying,
    notes text,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(6) without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp(6) without time zone DEFAULT now() NOT NULL,
    "assignmentType" character varying DEFAULT 'table'::character varying NOT NULL,
    "specialTaskLocation" character varying,
    "specialTaskStartTime" character varying,
    "specialTaskEndTime" character varying,
    "shiftStart" character varying(10),
    "shiftEnd" character varying(10)
);
CREATE TABLE public.events (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying NOT NULL,
    description character varying,
    "eventDate" timestamp(6) without time zone NOT NULL,
    "eventEndDate" timestamp(6) without time zone,
    "venueLayout" jsonb,
    status public.events_status_enum DEFAULT 'draft'::public.events_status_enum NOT NULL,
    "coverImage" character varying,
    "totalCapacity" integer DEFAULT 0 NOT NULL,
    "organizerId" uuid,
    "venueTemplateId" uuid,
    "createdAt" timestamp(6) without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp(6) without time zone DEFAULT now() NOT NULL,
    "eventType" character varying,
    "reviewEnabled" boolean DEFAULT false NOT NULL,
    "reviewHistoryVisible" boolean DEFAULT false NOT NULL,
    "reservationEnabled" boolean DEFAULT true NOT NULL
);
CREATE TABLE public.guest_notes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "customerId" uuid NOT NULL,
    "eventId" uuid,
    "reservationId" uuid,
    content text NOT NULL,
    "noteType" public.guest_notes_notetype_enum DEFAULT 'general'::public.guest_notes_notetype_enum NOT NULL,
    "createdBy" character varying,
    "createdAt" timestamp(6) without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp(6) without time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.invitation_templates (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying NOT NULL,
    description character varying,
    "isDefault" boolean DEFAULT false NOT NULL,
    "isSystemTemplate" boolean DEFAULT false NOT NULL,
    size character varying DEFAULT 'A5'::character varying NOT NULL,
    width integer DEFAULT 559 NOT NULL,
    height integer DEFAULT 794 NOT NULL,
    "backgroundColor" character varying,
    "backgroundImage" character varying,
    elements jsonb DEFAULT '[]'::jsonb NOT NULL,
    "createdById" uuid,
    "thumbnailUrl" character varying,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(6) without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp(6) without time zone DEFAULT now() NOT NULL,
    "backgroundGradient" character varying
);
CREATE TABLE public.migrations (
    id integer NOT NULL,
    "timestamp" bigint NOT NULL,
    name character varying NOT NULL
);
CREATE SEQUENCE public.migrations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    MAXVALUE 2147483647
    CACHE 1;
ALTER SEQUENCE public.migrations_id_seq OWNED BY public.migrations.id;
CREATE TABLE public.notification_reads (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "notificationId" uuid NOT NULL,
    "userId" uuid NOT NULL,
    "readAt" timestamp(6) without time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.notifications (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    type public.notifications_type_enum NOT NULL,
    title character varying NOT NULL,
    message text NOT NULL,
    priority public.notifications_priority_enum DEFAULT 'medium'::public.notifications_priority_enum NOT NULL,
    "targetRole" public.notifications_targetrole_enum DEFAULT 'all'::public.notifications_targetrole_enum NOT NULL,
    "eventId" uuid,
    "createdById" uuid,
    metadata jsonb,
    "actionUrl" character varying,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(6) without time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.organization_templates (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying NOT NULL,
    description text,
    "createdById" uuid,
    "staffAssignments" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "teamAssignments" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "tableGroups" jsonb DEFAULT '[]'::jsonb NOT NULL,
    settings jsonb DEFAULT '{}'::jsonb NOT NULL,
    tags text[] DEFAULT '{}'::text[] NOT NULL,
    "isDefault" boolean DEFAULT false NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(6) without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp(6) without time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.positions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    "sortOrder" integer DEFAULT 0,
    "isActive" boolean DEFAULT true,
    "createdAt" timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE public.reservations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "eventId" uuid NOT NULL,
    "tableId" character varying NOT NULL,
    "customerId" uuid,
    "guestCount" integer NOT NULL,
    "qrCodeHash" character varying NOT NULL,
    status public.reservations_status_enum DEFAULT 'pending'::public.reservations_status_enum NOT NULL,
    "checkInTime" timestamp(6) without time zone,
    "specialRequests" character varying,
    "totalAmount" numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    "isPaid" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(6) without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp(6) without time zone DEFAULT now() NOT NULL,
    "guestName" character varying,
    "guestPhone" character varying,
    "guestEmail" character varying
);
CREATE TABLE public.service_point_staff_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "eventId" uuid NOT NULL,
    "servicePointId" uuid NOT NULL,
    "staffId" uuid NOT NULL,
    role character varying(100) NOT NULL,
    "shiftId" uuid,
    "shiftStart" character varying(10),
    "shiftEnd" character varying(10),
    notes text,
    "sortOrder" integer DEFAULT 0,
    "isActive" boolean DEFAULT true,
    "createdAt" timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE public.service_points (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "eventId" uuid NOT NULL,
    name character varying(255) NOT NULL,
    "pointType" character varying(50) DEFAULT 'bar'::character varying,
    "requiredStaffCount" integer DEFAULT 1,
    "allowedRoles" text[] DEFAULT '{}'::text[],
    x double precision DEFAULT 0,
    y double precision DEFAULT 0,
    color character varying(50) DEFAULT '#06b6d4'::character varying,
    shape character varying(50) DEFAULT 'square'::character varying,
    description text,
    "sortOrder" integer DEFAULT 0,
    "isActive" boolean DEFAULT true,
    "createdAt" timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE public.service_teams (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "eventId" uuid,
    name character varying NOT NULL,
    color character varying DEFAULT '#3b82f6'::character varying NOT NULL,
    members jsonb DEFAULT '[]'::jsonb NOT NULL,
    "leaderId" character varying,
    "tableIds" text[] DEFAULT '{}'::text[] NOT NULL,
    "createdAt" timestamp(6) without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp(6) without time zone DEFAULT now() NOT NULL,
    leaders jsonb DEFAULT '[]'::jsonb
);
CREATE TABLE public.staff (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "sicilNo" character varying(255) NOT NULL,
    "fullName" character varying(255) NOT NULL,
    email character varying(255),
    phone character varying(50),
    avatar text,
    "position" character varying(255) NOT NULL,
    department character varying(255),
    "workLocation" character varying(255),
    mentor character varying(255),
    color character varying(50),
    gender public.gender_enum,
    "birthDate" date,
    age integer,
    "bloodType" character varying(10),
    "shoeSize" integer,
    "sockSize" character varying(10),
    "hireDate" date,
    "terminationDate" date,
    "terminationReason" text,
    "yearsAtCompany" integer,
    "isActive" boolean DEFAULT true,
    status public.staff_status_enum DEFAULT 'active'::public.staff_status_enum,
    "createdAt" timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE public.staff_assignments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "eventId" uuid NOT NULL,
    "staffId" uuid NOT NULL,
    "assignedTableIds" text[] DEFAULT '{}'::text[] NOT NULL,
    color character varying,
    "createdAt" timestamp(6) without time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.staff_colors (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying NOT NULL,
    color character varying NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(6) without time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.staff_performance_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "staffId" character varying NOT NULL,
    "eventId" character varying NOT NULL,
    "actionType" character varying NOT NULL,
    "responseTimeSeconds" integer,
    metadata jsonb,
    "createdAt" timestamp(6) without time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.staff_performance_reviews (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "staffId" uuid NOT NULL,
    "reviewerId" uuid NOT NULL,
    "eventId" uuid NOT NULL,
    score integer NOT NULL,
    rating public.staff_performance_reviews_rating_enum NOT NULL,
    comment text,
    "createdAt" timestamp(6) without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp(6) without time zone DEFAULT now() NOT NULL,
    "categoryScores" jsonb,
    strengths jsonb DEFAULT '[]'::jsonb,
    improvements jsonb DEFAULT '[]'::jsonb,
    "privateNotes" text,
    "recommendedTrainings" jsonb DEFAULT '[]'::jsonb,
    "nextEventNotes" text,
    "isCompleted" boolean DEFAULT false NOT NULL
);
CREATE TABLE public.staff_roles (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    key character varying NOT NULL,
    label character varying NOT NULL,
    color character varying DEFAULT '#3b82f6'::character varying NOT NULL,
    "badgeColor" character varying DEFAULT 'bg-blue-500/20 text-blue-400 border-blue-500/30'::character varying NOT NULL,
    "bgColor" character varying DEFAULT 'bg-blue-500'::character varying NOT NULL,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(6) without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp(6) without time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.system_settings (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "companyName" character varying DEFAULT 'Test Firması'::character varying NOT NULL,
    logo character varying,
    timezone character varying DEFAULT 'Europe/Istanbul'::character varying NOT NULL,
    language character varying DEFAULT 'tr'::character varying NOT NULL,
    "defaultGridSize" integer DEFAULT 20 NOT NULL,
    "snapToGrid" boolean DEFAULT true NOT NULL,
    "showGridByDefault" boolean DEFAULT true NOT NULL,
    "defaultGuestCount" integer DEFAULT 2 NOT NULL,
    "allowOverbooking" boolean DEFAULT false NOT NULL,
    "requirePhoneNumber" boolean DEFAULT true NOT NULL,
    "requireEmail" boolean DEFAULT false NOT NULL,
    "autoCheckInEnabled" boolean DEFAULT false NOT NULL,
    "checkInSoundEnabled" boolean DEFAULT true NOT NULL,
    "showTableDirections" boolean DEFAULT true NOT NULL,
    "emailNotifications" boolean DEFAULT true NOT NULL,
    "smsNotifications" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(6) without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp(6) without time zone DEFAULT now() NOT NULL,
    "smtpHost" character varying,
    "smtpPort" integer DEFAULT 587 NOT NULL,
    "smtpUser" character varying,
    "smtpPassword" character varying,
    "smtpFromEmail" character varying,
    "smtpFromName" character varying,
    "smtpSecure" boolean DEFAULT false NOT NULL,
    "qrCodeSystemEnabled" boolean DEFAULT true NOT NULL,
    "invitationSystemEnabled" boolean DEFAULT true NOT NULL
);
CREATE TABLE public.table_groups (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "eventId" uuid NOT NULL,
    name character varying NOT NULL,
    color character varying DEFAULT '#3b82f6'::character varying NOT NULL,
    "tableIds" text[] DEFAULT '{}'::text[] NOT NULL,
    "assignedTeamId" character varying,
    "assignedSupervisorId" character varying,
    "groupType" character varying DEFAULT 'standard'::character varying NOT NULL,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    notes character varying,
    "createdAt" timestamp(6) without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp(6) without time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.table_types (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying NOT NULL,
    color character varying DEFAULT '#3b82f6'::character varying NOT NULL,
    icon character varying,
    "basePrice" numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    shape character varying DEFAULT 'round'::character varying NOT NULL,
    "createdAt" timestamp(6) without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp(6) without time zone DEFAULT now() NOT NULL,
    capacity integer DEFAULT 8 NOT NULL,
    "minSpacing" integer DEFAULT 50 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL
);
CREATE TABLE public.teams (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying NOT NULL,
    color character varying DEFAULT '#3b82f6'::character varying NOT NULL,
    "memberIds" text[] DEFAULT '{}'::text[] NOT NULL,
    "leaderId" uuid,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(6) without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp(6) without time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    email character varying,
    password character varying NOT NULL,
    "fullName" character varying NOT NULL,
    phone character varying,
    role public.users_role_enum DEFAULT 'organizer'::public.users_role_enum NOT NULL,
    avatar character varying,
    color character varying,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(6) without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp(6) without time zone DEFAULT now() NOT NULL,
    "position" character varying,
    username character varying
);
CREATE TABLE public.venue_templates (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying NOT NULL,
    description character varying,
    "layoutData" jsonb NOT NULL,
    "isPublic" boolean DEFAULT false NOT NULL,
    thumbnail character varying,
    "createdBy" character varying,
    "usageCount" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(6) without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp(6) without time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.work_locations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    address text,
    "sortOrder" integer DEFAULT 0,
    "isActive" boolean DEFAULT true,
    "createdAt" timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE public.work_shifts (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying NOT NULL,
    "startTime" time(6) without time zone NOT NULL,
    "endTime" time(6) without time zone NOT NULL,
    color character varying DEFAULT '#3b82f6'::character varying NOT NULL,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(6) without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp(6) without time zone DEFAULT now() NOT NULL,
    "eventId" uuid
);
ALTER TABLE ONLY public.migrations ALTER COLUMN id SET DEFAULT nextval('public.migrations_id_seq'::regclass);
ALTER TABLE ONLY public.organization_templates
    ADD CONSTRAINT "PK_04821cf14f17052feac3bd1cdac" PRIMARY KEY (id);
ALTER TABLE ONLY public.customers
    ADD CONSTRAINT "PK_133ec679a801fab5e070f73d3ea" PRIMARY KEY (id);
ALTER TABLE ONLY public.service_teams
    ADD CONSTRAINT "PK_1a5ac674a6a5dc1f4b3da037bde" PRIMARY KEY (id);
ALTER TABLE ONLY public.guest_notes
    ADD CONSTRAINT "PK_1c636b208282dc9a6bb7458e774" PRIMARY KEY (id);
ALTER TABLE ONLY public.venue_templates
    ADD CONSTRAINT "PK_1f303d3c6c6b34200a044ae99c3" PRIMARY KEY (id);
ALTER TABLE ONLY public.invitation_templates
    ADD CONSTRAINT "PK_20bc005d6ed5f0ba5127eacc04c" PRIMARY KEY (id);
ALTER TABLE ONLY public.work_shifts
    ADD CONSTRAINT "PK_30826a4f3460a48369193453043" PRIMARY KEY (id);
ALTER TABLE ONLY public.staff_colors
    ADD CONSTRAINT "PK_38f2b0d6096e259e75228f76823" PRIMARY KEY (id);
ALTER TABLE ONLY public.events
    ADD CONSTRAINT "PK_40731c7151fe4be3116e45ddf73" PRIMARY KEY (id);
ALTER TABLE ONLY public.event_invitations
    ADD CONSTRAINT "PK_48ba3c43da3ae3e1f824f671da7" PRIMARY KEY (id);
ALTER TABLE ONLY public.staff_performance_reviews
    ADD CONSTRAINT "PK_68053d525d6d2bf37235ef930b6" PRIMARY KEY (id);
ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT "PK_6a72c3c0f683f6462415e653c3a" PRIMARY KEY (id);
ALTER TABLE ONLY public.teams
    ADD CONSTRAINT "PK_7e5523774a38b08a6236d322403" PRIMARY KEY (id);
ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT "PK_82521f08790d248b2a80cc85d40" PRIMARY KEY (id);
ALTER TABLE ONLY public.staff_roles
    ADD CONSTRAINT "PK_87101d9c9d1604a36152cfad1c5" PRIMARY KEY (id);
ALTER TABLE ONLY public.migrations
    ADD CONSTRAINT "PK_8c82d7f526340ab734260ea46be" PRIMARY KEY (id);
ALTER TABLE ONLY public.event_staff_assignments
    ADD CONSTRAINT "PK_95d19d774f375424f6cc753a246" PRIMARY KEY (id);
ALTER TABLE ONLY public.users
    ADD CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY (id);
ALTER TABLE ONLY public.staff_assignments
    ADD CONSTRAINT "PK_ab013446523a48ceb9b14144530" PRIMARY KEY (id);
ALTER TABLE ONLY public.notification_reads
    ADD CONSTRAINT "PK_c49ec541db45925cfb4e5c8dfbd" PRIMARY KEY (id);
ALTER TABLE ONLY public.staff_performance_logs
    ADD CONSTRAINT "PK_d504eec899ecaad558fabc68cec" PRIMARY KEY (id);
ALTER TABLE ONLY public.reservations
    ADD CONSTRAINT "PK_da95cef71b617ac35dc5bcda243" PRIMARY KEY (id);
ALTER TABLE ONLY public.table_groups
    ADD CONSTRAINT "PK_db32d5f0734ec6a614921c84691" PRIMARY KEY (id);
ALTER TABLE ONLY public.table_types
    ADD CONSTRAINT "PK_efbcef8663eddc2ab66e5041671" PRIMARY KEY (id);
ALTER TABLE ONLY public.reservations
    ADD CONSTRAINT "UQ_28b3433cc468d825c15b9b64184" UNIQUE ("qrCodeHash");
ALTER TABLE ONLY public.users
    ADD CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE (email);
ALTER TABLE ONLY public.staff_roles
    ADD CONSTRAINT "UQ_ce167cffe91561f5c25270b4e1e" UNIQUE (key);
ALTER TABLE ONLY public.users
    ADD CONSTRAINT "UQ_fe0bb3f6520ee0469504521e710" UNIQUE (username);
ALTER TABLE ONLY public.department_locations
    ADD CONSTRAINT "department_locations_departmentId_workLocationId_key" UNIQUE ("departmentId", "workLocationId");
ALTER TABLE ONLY public.department_locations
    ADD CONSTRAINT department_locations_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.department_positions
    ADD CONSTRAINT "department_positions_departmentId_positionId_key" UNIQUE ("departmentId", "positionId");
ALTER TABLE ONLY public.department_positions
    ADD CONSTRAINT department_positions_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_name_key UNIQUE (name);
ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.event_extra_staff
    ADD CONSTRAINT event_extra_staff_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.positions
    ADD CONSTRAINT positions_name_key UNIQUE (name);
ALTER TABLE ONLY public.positions
    ADD CONSTRAINT positions_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.service_point_staff_assignments
    ADD CONSTRAINT service_point_staff_assignments_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.service_points
    ADD CONSTRAINT service_points_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.staff
    ADD CONSTRAINT "staff_sicilNo_key" UNIQUE ("sicilNo");
ALTER TABLE ONLY public.work_locations
    ADD CONSTRAINT work_locations_name_key UNIQUE (name);
ALTER TABLE ONLY public.work_locations
    ADD CONSTRAINT work_locations_pkey PRIMARY KEY (id);
CREATE INDEX "IDX_3226ca8721b0b0474f315a6b32" ON public.notifications USING btree ("targetRole", "createdAt");
CREATE INDEX "IDX_329386085bc065c93e74677c37" ON public.staff_performance_reviews USING btree ("eventId");
CREATE UNIQUE INDEX "IDX_368e4a570651c6ea1475099779" ON public.notification_reads USING btree ("notificationId", "userId");
CREATE UNIQUE INDEX "IDX_4843f1492981131e7a2a5659b5" ON public.staff_performance_reviews USING btree ("staffId", "eventId", "reviewerId");
CREATE INDEX "IDX_a8287a630ee73ee55dbf9eea2b" ON public.notification_reads USING btree ("userId", "readAt");
CREATE INDEX "IDX_customer_autocomplete" ON public.customers USING btree ("fullName", "totalAttendedEvents" DESC) INCLUDE (id, phone, email, "vipScore");
CREATE INDEX "IDX_customer_email" ON public.customers USING btree (email);
CREATE INDEX "IDX_customer_fullName" ON public.customers USING btree ("fullName");
CREATE INDEX "IDX_customer_fullname_trgm" ON public.customers USING gin ("fullName" public.gin_trgm_ops);
CREATE INDEX "IDX_customer_phone" ON public.customers USING btree (phone);
CREATE INDEX "IDX_customer_search_multi" ON public.customers USING btree ("fullName", phone, email);
CREATE INDEX "IDX_customer_search_name" ON public.customers USING gin (to_tsvector('english'::regconfig, ("fullName")::text));
CREATE INDEX "IDX_customer_vipScore" ON public.customers USING btree ("vipScore");
CREATE INDEX "IDX_departments_is_active" ON public.departments USING btree ("isActive");
CREATE INDEX "IDX_dept_loc_location" ON public.department_locations USING btree ("workLocationId");
CREATE INDEX "IDX_dept_pos_position" ON public.department_positions USING btree ("positionId");
CREATE INDEX "IDX_event_extra_staff_event" ON public.event_extra_staff USING btree (event_id);
CREATE INDEX "IDX_event_has_layout" ON public.events USING btree (id) WHERE ("venueLayout" IS NOT NULL);
CREATE INDEX "IDX_event_organizer_date" ON public.events USING btree ("organizerId", "eventDate");
CREATE INDEX "IDX_event_staff_assignment_event_active" ON public.event_staff_assignments USING btree ("eventId", "isActive");
CREATE INDEX "IDX_event_staff_assignment_shift" ON public.event_staff_assignments USING btree ("shiftId") WHERE ("shiftId" IS NOT NULL);
CREATE INDEX "IDX_event_staff_assignment_staff_active" ON public.event_staff_assignments USING btree ("staffId", "isActive");
CREATE INDEX "IDX_event_staff_assignment_tables" ON public.event_staff_assignments USING gin ("tableIds");
CREATE INDEX "IDX_event_staff_assignment_team" ON public.event_staff_assignments USING btree ("teamId") WHERE ("teamId" IS NOT NULL);
CREATE INDEX "IDX_event_status_date" ON public.events USING btree (status, "eventDate");
CREATE INDEX "IDX_event_venue_layout" ON public.events USING gin ("venueLayout" jsonb_path_ops);
CREATE INDEX "IDX_event_venue_layout_tables" ON public.events USING gin ((("venueLayout" -> 'tables'::text)));
CREATE INDEX "IDX_fd14f67af04f17d8d7a6356168" ON public.notifications USING btree (type, "createdAt");
CREATE INDEX "IDX_guest_note_created" ON public.guest_notes USING btree ("createdAt" DESC);
CREATE INDEX "IDX_guest_note_customer_event" ON public.guest_notes USING btree ("customerId", "eventId");
CREATE INDEX "IDX_guest_note_event" ON public.guest_notes USING btree ("eventId");
CREATE INDEX "IDX_positions_is_active" ON public.positions USING btree ("isActive");
CREATE INDEX "IDX_reservation_customer" ON public.reservations USING btree ("customerId");
CREATE INDEX "IDX_reservation_event_status" ON public.reservations USING btree ("eventId", status);
CREATE INDEX "IDX_reservation_event_table" ON public.reservations USING btree ("eventId", "tableId");
CREATE INDEX "IDX_service_point_event_active" ON public.service_points USING btree ("eventId", "isActive");
CREATE INDEX "IDX_service_team_event" ON public.service_teams USING btree ("eventId");
CREATE INDEX "IDX_service_team_leader" ON public.service_teams USING btree ("leaderId") WHERE ("leaderId" IS NOT NULL);
CREATE INDEX "IDX_service_team_members" ON public.service_teams USING gin (members);
CREATE INDEX "IDX_service_team_tables" ON public.service_teams USING gin ("tableIds");
CREATE INDEX "IDX_sp_staff_assignment_event_active" ON public.service_point_staff_assignments USING btree ("eventId", "isActive");
CREATE INDEX "IDX_sp_staff_assignment_service_point" ON public.service_point_staff_assignments USING btree ("servicePointId");
CREATE INDEX "IDX_sp_staff_assignment_staff" ON public.service_point_staff_assignments USING btree ("staffId");
CREATE INDEX "IDX_staff_assignment_event_staff" ON public.staff_assignments USING btree ("eventId", "staffId");
CREATE INDEX "IDX_staff_assignment_staff" ON public.staff_assignments USING btree ("staffId");
CREATE INDEX "IDX_staff_department" ON public.staff USING btree (department);
CREATE INDEX "IDX_staff_is_active" ON public.staff USING btree ("isActive");
CREATE INDEX "IDX_staff_position" ON public.staff USING btree ("position");
CREATE INDEX "IDX_staff_role_active" ON public.staff_roles USING btree (id) WHERE ("isActive" = true);
CREATE INDEX "IDX_staff_status" ON public.staff USING btree (status);
CREATE INDEX "IDX_staff_work_location" ON public.staff USING btree ("workLocation");
CREATE INDEX "IDX_table_group_event_order" ON public.table_groups USING btree ("eventId", "sortOrder");
CREATE INDEX "IDX_table_group_supervisor" ON public.table_groups USING btree ("assignedSupervisorId") WHERE ("assignedSupervisorId" IS NOT NULL);
CREATE INDEX "IDX_table_group_tables" ON public.table_groups USING gin ("tableIds");
CREATE INDEX "IDX_table_group_team" ON public.table_groups USING btree ("assignedTeamId");
CREATE INDEX "IDX_team_active" ON public.teams USING btree (id) WHERE ("isActive" = true);
CREATE INDEX "IDX_user_role_active" ON public.users USING btree (role, "isActive");
CREATE INDEX "IDX_work_locations_is_active" ON public.work_locations USING btree ("isActive");
CREATE INDEX "IDX_work_shift_active" ON public.work_shifts USING btree (id) WHERE ("isActive" = true);
CREATE INDEX idx_event_venue_layout_tables ON public.events USING gin ((("venueLayout" -> 'tables'::text)));
ALTER TABLE ONLY public.guest_notes
    ADD CONSTRAINT "FK_02571e3069e38cc1ecd5dbea5e0" FOREIGN KEY ("eventId") REFERENCES public.events(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.events
    ADD CONSTRAINT "FK_1024d476207981d1c72232cf3ca" FOREIGN KEY ("organizerId") REFERENCES public.users(id);
ALTER TABLE ONLY public.event_staff_assignments
    ADD CONSTRAINT "FK_1b4faab579468c09c3697768241" FOREIGN KEY ("shiftId") REFERENCES public.work_shifts(id);
ALTER TABLE ONLY public.staff_performance_reviews
    ADD CONSTRAINT "FK_20bb1a24bb90c15406d8e401374" FOREIGN KEY ("staffId") REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.staff_assignments
    ADD CONSTRAINT "FK_20f256de1a759e34e93fe5af635" FOREIGN KEY ("staffId") REFERENCES public.users(id);
ALTER TABLE ONLY public.organization_templates
    ADD CONSTRAINT "FK_30e1eecb4e1237d1024af755bc6" FOREIGN KEY ("createdById") REFERENCES public.users(id);
ALTER TABLE ONLY public.staff_performance_reviews
    ADD CONSTRAINT "FK_329386085bc065c93e74677c376" FOREIGN KEY ("eventId") REFERENCES public.events(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT "FK_3337493bfdc5d0fccd4bd5f51e3" FOREIGN KEY ("eventId") REFERENCES public.events(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.notification_reads
    ADD CONSTRAINT "FK_38d077b9c1f597ae662c5ae4119" FOREIGN KEY ("notificationId") REFERENCES public.notifications(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.service_teams
    ADD CONSTRAINT "FK_3bfe8a10af06f138d317cea6618" FOREIGN KEY ("eventId") REFERENCES public.events(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.reservations
    ADD CONSTRAINT "FK_487ec4ed757eed0d34c7ddee79b" FOREIGN KEY ("customerId") REFERENCES public.customers(id);
ALTER TABLE ONLY public.teams
    ADD CONSTRAINT "FK_6d5c85d3f2602450d1e615afae9" FOREIGN KEY ("leaderId") REFERENCES public.users(id);
ALTER TABLE ONLY public.invitation_templates
    ADD CONSTRAINT "FK_6dfa3fed5d9416a1ad358848601" FOREIGN KEY ("createdById") REFERENCES public.users(id);
ALTER TABLE ONLY public.event_invitations
    ADD CONSTRAINT "FK_764a93b6cf050602dba6d749d6e" FOREIGN KEY ("templateId") REFERENCES public.invitation_templates(id);
ALTER TABLE ONLY public.staff_performance_reviews
    ADD CONSTRAINT "FK_7cc4d982edecc5572f6d606514b" FOREIGN KEY ("reviewerId") REFERENCES public.users(id);
ALTER TABLE ONLY public.events
    ADD CONSTRAINT "FK_8c1b174cc210482e609b7ee2ee1" FOREIGN KEY ("venueTemplateId") REFERENCES public.venue_templates(id);
ALTER TABLE ONLY public.staff_assignments
    ADD CONSTRAINT "FK_a85bdbd7a63c7ff1013d2b252cf" FOREIGN KEY ("eventId") REFERENCES public.events(id);
ALTER TABLE ONLY public.event_staff_assignments
    ADD CONSTRAINT "FK_b9d21f03c9ba48a579f8c9208ac" FOREIGN KEY ("teamId") REFERENCES public.teams(id);
ALTER TABLE ONLY public.notification_reads
    ADD CONSTRAINT "FK_bddd24aed9c7f0beee6e8d8339f" FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.event_staff_assignments
    ADD CONSTRAINT "FK_c37a8d83d0469572061818daa8a" FOREIGN KEY ("eventId") REFERENCES public.events(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.reservations
    ADD CONSTRAINT "FK_c6fda79964e4d3a3e3f9843fbc1" FOREIGN KEY ("eventId") REFERENCES public.events(id);
ALTER TABLE ONLY public.guest_notes
    ADD CONSTRAINT "FK_cef5d71e0adf5cbe464a78fac1f" FOREIGN KEY ("customerId") REFERENCES public.customers(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.table_groups
    ADD CONSTRAINT "FK_d2295fe7f37fde260745b141a65" FOREIGN KEY ("eventId") REFERENCES public.events(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.guest_notes
    ADD CONSTRAINT "FK_d8e8964ad7e1253c0cd3c060e57" FOREIGN KEY ("reservationId") REFERENCES public.reservations(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT "FK_fcce8c50a375466676d82dcbadd" FOREIGN KEY ("createdById") REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.event_staff_assignments
    ADD CONSTRAINT "FK_staff_assignments_staff" FOREIGN KEY ("staffId") REFERENCES public.staff(id);
ALTER TABLE ONLY public.department_locations
    ADD CONSTRAINT "department_locations_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES public.departments(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.department_locations
    ADD CONSTRAINT "department_locations_workLocationId_fkey" FOREIGN KEY ("workLocationId") REFERENCES public.work_locations(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.department_positions
    ADD CONSTRAINT "department_positions_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES public.departments(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.department_positions
    ADD CONSTRAINT "department_positions_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES public.positions(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.event_extra_staff
    ADD CONSTRAINT event_extra_staff_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.service_point_staff_assignments
    ADD CONSTRAINT "service_point_staff_assignments_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES public.events(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.service_point_staff_assignments
    ADD CONSTRAINT "service_point_staff_assignments_servicePointId_fkey" FOREIGN KEY ("servicePointId") REFERENCES public.service_points(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.service_points
    ADD CONSTRAINT "service_points_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES public.events(id) ON DELETE CASCADE;
