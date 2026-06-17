-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ConsultStatus" AS ENUM ('NEW', 'CONTACTED', 'BOOKED', 'COMPLETED', 'CLOSED');

-- CreateEnum
CREATE TYPE "InteractionType" AS ENUM ('NOTE', 'CLINICAL', 'COMPLAINT', 'FOLLOW_UP', 'CALL', 'EMAIL', 'SMS', 'APPOINTMENT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "EmailKind" AS ENUM ('CONSULT_REPLY', 'CONSULT_NOTIFY', 'BIRTHDAY', 'FOLLOW_UP', 'WIN_BACK', 'REVIEW_REQUEST', 'APPOINTMENT_REMINDER', 'FORM_REMINDER', 'PASSWORD_RESET', 'CAMPAIGN', 'MANUAL', 'MEMBERSHIP', 'CHAT', 'ABANDONED_BOOKING', 'NO_SHOW', 'STAFF_DIGEST', 'STAFF_NUDGE', 'AFTERCARE', 'SATISFACTION', 'REBOOK_NUDGE');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'ADMIN', 'PRACTITIONER', 'FRONT_DESK', 'DEVELOPER', 'CONTRACTOR', 'STAFF');

-- CreateEnum
CREATE TYPE "AssessmentType" AS ENUM ('MEDICAL_HISTORY', 'TREATMENT_CONSENT', 'PRE_TREATMENT', 'SKIN_PROFILE', 'DENTAL_HISTORY');

-- CreateEnum
CREATE TYPE "DiscountStatus" AS ENUM ('ACTIVE', 'REDEEMED', 'REVOKED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "ClientPointsCategory" AS ENUM ('SPEND', 'REVIEW', 'BIRTHDAY', 'REFERRAL', 'REDEMPTION', 'MANUAL', 'EXPIRY');

-- CreateEnum
CREATE TYPE "ReferralStatus" AS ENUM ('PENDING', 'JOINED', 'QUALIFIED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('FEMALE', 'MALE', 'NON_BINARY', 'OTHER', 'PREFER_NOT_TO_SAY');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('REQUESTED', 'PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('BOOKING_CREATED', 'BOOKING_RESCHEDULED', 'BOOKING_CONFIRMED', 'BOOKING_CANCELLED', 'BOOKING_NO_SHOW', 'PRACTITIONER_ASSIGNED', 'APPOINTMENT_STARTED', 'APPOINTMENT_COMPLETED', 'SOP_ACKNOWLEDGED', 'MEDICAL_FLAG_REVIEWED', 'PAYMENT_CHARGED', 'PAYMENT_FAILED', 'PAYMENT_REFUNDED', 'XERO_INVOICE_PUSHED', 'XERO_REFUND_PUSHED', 'ASSESSMENT_SUBMITTED', 'ASSESSMENT_VIEWED', 'NOTE_ADDED', 'TIMEOFF_ADDED', 'TIMEOFF_REQUESTED', 'TIMEOFF_APPROVED', 'TIMEOFF_DECLINED', 'TIMEOFF_CANCELLED', 'CONSUMABLE_USED', 'REVIEW_REQUESTED', 'REVIEW_RECEIVED', 'REVIEW_PUBLISHED', 'POINTS_AWARDED', 'REWARD_REDEEMED', 'SERVICE_PRICES_BULK', 'SETTINGS_UPDATED', 'CONSENT_REQUESTED', 'CONSENT_SIGNED', 'CONSENT_DECLINED', 'BEFORE_PHOTO_CAPTURED', 'CLIENT_DELETED', 'CLIENT_ERASED', 'CLIENT_EDITED', 'DATA_EXPORTED', 'DATA_IMPORTED', 'SESSION_EDITED', 'EMAIL_SENT', 'TASK_ASSIGNED', 'TASK_COMPLETED', 'ROOM_TURNOVER');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'SUBMITTED', 'APPROVED', 'PUBLISHED', 'HIDDEN');

-- CreateEnum
CREATE TYPE "ReviewChannel" AS ENUM ('EMAIL', 'SMS');

-- CreateEnum
CREATE TYPE "TimeOffKind" AS ENUM ('HOLIDAY', 'SICK', 'TRAINING', 'PERSONAL', 'BLOCKED', 'GCAL_BUSY');

-- CreateEnum
CREATE TYPE "TimeOffStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('OPEN', 'DONE');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH');

-- CreateEnum
CREATE TYPE "StockMoveReason" AS ENUM ('RECEIVED', 'USED', 'WASTED', 'RETURNED', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "CashflowType" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "CashCadence" AS ENUM ('ONE_OFF', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL');

-- CreateEnum
CREATE TYPE "CallDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "CallMatchType" AS ENUM ('CLIENT', 'SUPPLIER', 'STAFF', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'ENDED');

-- CreateEnum
CREATE TYPE "ServiceStatus" AS ENUM ('NORMAL', 'CONSULTATION', 'COMING_SOON', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "OfferScope" AS ENUM ('ALL', 'SERVICE', 'VARIANT');

-- CreateEnum
CREATE TYPE "TimeEntryKind" AS ENUM ('SHIFT', 'BREAK');

-- CreateEnum
CREATE TYPE "FacilityDocType" AS ENUM ('FLOOR_PLAN', 'ELECTRICAL', 'PLUMBING', 'EQUIPMENT', 'INSTRUCTION', 'OTHER');

-- CreateEnum
CREATE TYPE "ContractorTaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE');

-- CreateEnum
CREATE TYPE "ContractorStatus" AS ENUM ('PENDING', 'APPROVED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "PointsCategory" AS ENUM ('REVIEW', 'EFFICIENCY', 'CONSUMABLES', 'PUNCTUALITY', 'PERFORMANCE', 'FRIENDLINESS', 'TEAMWORK', 'MANUAL', 'REDEMPTION', 'REVENUE', 'UPSELL', 'REBOOK');

-- CreateEnum
CREATE TYPE "RedemptionStatus" AS ENUM ('PENDING', 'FULFILLED', 'DECLINED');

-- CreateEnum
CREATE TYPE "ResourceKind" AS ENUM ('ROOM', 'EQUIPMENT');

-- CreateEnum
CREATE TYPE "RoomPrepStatus" AS ENUM ('DIRTY', 'CLEANING', 'READY');

-- CreateEnum
CREATE TYPE "HomeworkStatus" AS ENUM ('SUBMITTED', 'REVIEWED', 'APPROVED', 'NEEDS_REVISION');

-- CreateEnum
CREATE TYPE "CohortStatus" AS ENUM ('OPEN', 'FULL', 'CLOSED');

-- CreateEnum
CREATE TYPE "EnrolmentStatus" AS ENUM ('APPLIED', 'OFFERED', 'PAID', 'ENROLLED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FundingStatus" AS ENUM ('NEW', 'REVIEWING', 'REFERRED', 'APPROVED', 'DECLINED', 'FUNDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "PostStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "AbStatus" AS ENUM ('DRAFT', 'RUNNING', 'STOPPED');

-- CreateEnum
CREATE TYPE "ConsentStatus" AS ENUM ('PENDING', 'SIGNED', 'DECLINED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PAID', 'FULFILLED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "DayCloseStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "BuildType" AS ENUM ('ERROR', 'TASK', 'IDEA', 'REVIEW', 'AUDIT');

-- CreateEnum
CREATE TYPE "BuildStatus" AS ENUM ('TRIAGE', 'IN_PROGRESS', 'IN_REVIEW', 'BLOCKED', 'SHIPPED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BuildUrgency" AS ENUM ('P0', 'P1', 'P2', 'P3');

-- CreateEnum
CREATE TYPE "KioskStatus" AS ENUM ('ACTIVE', 'PHOTO_TAKEN', 'ANALYSIS_FAILED', 'ANALYZED', 'SHARED', 'EXPIRED', 'AGE_DECLINED');

-- CreateEnum
CREATE TYPE "DeviceKind" AS ENUM ('TERMINAL', 'DISPLAY', 'KIOSK', 'SCANNER', 'PRINTER', 'OTHER');

-- CreateEnum
CREATE TYPE "WaitlistStatus" AS ENUM ('ACTIVE', 'NOTIFIED', 'CLAIMED', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "CashflowEntry" (
    "id" TEXT NOT NULL,
    "type" "CashflowType" NOT NULL,
    "category" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amountPence" INTEGER NOT NULL,
    "cadence" "CashCadence" NOT NULL DEFAULT 'MONTHLY',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashflowEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashReserve" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "targetPence" INTEGER NOT NULL DEFAULT 0,
    "balancePence" INTEGER NOT NULL DEFAULT 0,
    "monthlyContributionPence" INTEGER NOT NULL DEFAULT 0,
    "color" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashReserve_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "dob" TIMESTAMP(3),
    "ageDeclaredAt" TIMESTAMP(3),
    "gender" "Gender",
    "genderSelfDescribe" TEXT,
    "source" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "allergies" TEXT,
    "marketingOptIn" BOOLEAN NOT NULL DEFAULT false,
    "marketingConsentAt" TIMESTAMP(3),
    "marketingConsentSource" TEXT,
    "marketingConsentVersion" TEXT,
    "repermissionSentAt" TIMESTAMP(3),
    "smsReminders" BOOLEAN NOT NULL DEFAULT false,
    "concerns" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "onboardedAt" TIMESTAMP(3),
    "unsubscribed" BOOLEAN NOT NULL DEFAULT false,
    "unsubToken" TEXT NOT NULL,
    "lastVisitAt" TIMESTAMP(3),
    "stripeCustomerId" TEXT,
    "membershipTier" TEXT,
    "membership12moPence" INTEGER NOT NULL DEFAULT 0,
    "membershipUpdatedAt" TIMESTAMP(3),
    "passwordHash" TEXT,
    "emailVerified" TIMESTAMP(3),
    "portalActive" BOOLEAN NOT NULL DEFAULT false,
    "sessionEpoch" INTEGER NOT NULL DEFAULT 0,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "lastLoginAt" TIMESTAMP(3),
    "resetTokenHash" TEXT,
    "resetTokenExp" TIMESTAMP(3),
    "firstDiscountClaimed" BOOLEAN NOT NULL DEFAULT false,
    "signupIp" TEXT,
    "referralCode" TEXT,
    "referredById" TEXT,
    "medicalFlag" TEXT,
    "medicalFlagSetBy" TEXT,
    "medicalFlagAt" TIMESTAMP(3),
    "leaderboardOptIn" BOOLEAN NOT NULL DEFAULT false,
    "leaderboardPhotoUrl" TEXT,
    "leaderboardDisplayName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "contactName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "addressLine" TEXT,
    "city" TEXT,
    "postcode" TEXT,
    "country" TEXT DEFAULT 'GB',
    "accountNumber" TEXT,
    "notes" TEXT,
    "xeroContactId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallRecord" (
    "id" TEXT NOT NULL,
    "yayId" TEXT NOT NULL,
    "direction" "CallDirection" NOT NULL,
    "fromNumber" TEXT NOT NULL,
    "toNumber" TEXT NOT NULL,
    "status" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "answeredAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "durationSec" INTEGER NOT NULL DEFAULT 0,
    "agentExtension" TEXT,
    "agentEmail" TEXT,
    "recordingUrl" TEXT,
    "recordingMime" TEXT,
    "transcript" TEXT,
    "transcriptStatus" TEXT NOT NULL DEFAULT 'pending',
    "matchType" "CallMatchType" NOT NULL DEFAULT 'UNKNOWN',
    "matchedClientId" TEXT,
    "matchedSupplierId" TEXT,
    "matchedLabel" TEXT,
    "notes" TEXT,
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Consultation" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "treatments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "concerns" TEXT,
    "message" TEXT,
    "preferredTime" TEXT,
    "preferredContact" TEXT,
    "medicalNotes" TEXT,
    "status" "ConsultStatus" NOT NULL DEFAULT 'NEW',
    "assignedTo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Consultation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsultationNote" (
    "id" TEXT NOT NULL,
    "consultationId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsultationNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Interaction" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "type" "InteractionType" NOT NULL DEFAULT 'NOTE',
    "summary" TEXT NOT NULL,
    "detail" TEXT,
    "author" TEXT,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Interaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "treatment" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "followUpSent" BOOLEAN NOT NULL DEFAULT false,
    "reviewSent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "treatmentSlug" TEXT NOT NULL,
    "treatmentTitle" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "durationMin" INTEGER NOT NULL,
    "bufferMin" INTEGER NOT NULL DEFAULT 0,
    "pricePence" INTEGER NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "refreshments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "allergyNote" TEXT,
    "aftercareAckAt" TIMESTAMP(3),
    "pointsRedeemed" INTEGER NOT NULL DEFAULT 0,
    "pointsRedeemedPence" INTEGER NOT NULL DEFAULT 0,
    "practitionerId" TEXT,
    "locationId" TEXT,
    "arrivedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "actualMinutes" INTEGER,
    "clinicalNoteEnc" TEXT,
    "clinicalNoteBy" TEXT,
    "clinicalNoteAt" TIMESTAMP(3),
    "sopAcknowledgedAt" TIMESTAMP(3),
    "sopAcknowledgedBy" TEXT,
    "sopChecklistEnc" TEXT,
    "medicalFlagReviewedAt" TIMESTAMP(3),
    "medicalFlagReviewedBy" TEXT,
    "stripeCustomerId" TEXT,
    "stripeSetupIntentId" TEXT,
    "stripePaymentMethodId" TEXT,
    "chargePaymentIntentId" TEXT,
    "chargedPence" INTEGER,
    "chargedAt" TIMESTAMP(3),
    "refundedPence" INTEGER,
    "refundedAt" TIMESTAMP(3),
    "refundReason" TEXT,
    "xeroInvoiceId" TEXT,
    "xeroCreditNoteIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "cancelledBy" TEXT,
    "lateCancel" BOOLEAN NOT NULL DEFAULT false,
    "feeWaived" BOOLEAN NOT NULL DEFAULT false,
    "manageToken" TEXT NOT NULL,
    "remindersSent" BOOLEAN NOT NULL DEFAULT false,
    "reminder72hSent" BOOLEAN NOT NULL DEFAULT false,
    "reminder48hSent" BOOLEAN NOT NULL DEFAULT false,
    "rescheduleCount" INTEGER NOT NULL DEFAULT 0,
    "googleEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "attribSource" TEXT,
    "attribMedium" TEXT,
    "attribCampaign" TEXT,
    "attribLanding" TEXT,
    "gclid" TEXT,
    "marketingCampaignId" TEXT,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppointmentSession" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "currentStep" TEXT NOT NULL DEFAULT 'arrival',
    "startedBy" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "steps" JSONB NOT NULL DEFAULT '{}',
    "data" JSONB NOT NULL DEFAULT '{}',
    "touchpoints" JSONB NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppointmentSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingCampaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "goal" TEXT,
    "audience" TEXT,
    "description" TEXT,
    "heroImage" TEXT,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "budgetPence" INTEGER,
    "spendPence" INTEGER NOT NULL DEFAULT 0,
    "spendSyncedAt" TIMESTAMP(3),
    "targetRevenuePence" INTEGER,
    "targetBookings" INTEGER,
    "utmCampaign" TEXT,
    "channels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "brief" TEXT,
    "aiDraft" JSONB,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "treatmentSlug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'aesthetics',
    "vatClass" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "status" "ServiceStatus" NOT NULL DEFAULT 'NORMAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceVariant" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "durationMin" INTEGER NOT NULL DEFAULT 30,
    "pricePence" INTEGER NOT NULL,
    "costPence" INTEGER,
    "courses" JSONB,
    "order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "status" "ServiceStatus",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceOffer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scope" "OfferScope" NOT NULL DEFAULT 'ALL',
    "serviceId" TEXT,
    "variantId" TEXT,
    "percentOff" INTEGER,
    "amountOffPence" INTEGER,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "promoted" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingItem" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "variantId" TEXT,
    "treatmentSlug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sessions" INTEGER NOT NULL DEFAULT 1,
    "durationMin" INTEGER NOT NULL DEFAULT 0,
    "pricePence" INTEGER NOT NULL DEFAULT 0,
    "discountPence" INTEGER NOT NULL DEFAULT 0,
    "isAddon" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailEvent" (
    "id" TEXT NOT NULL,
    "clientId" TEXT,
    "kind" "EmailKind" NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" "EmailStatus" NOT NULL DEFAULT 'QUEUED',
    "providerId" TEXT,
    "campaignId" TEXT,
    "error" TEXT,
    "meta" JSONB,
    "openedAt" TIMESTAMP(3),
    "clickedAt" TIMESTAMP(3),
    "bouncedAt" TIMESTAMP(3),
    "complainedAt" TIMESTAMP(3),
    "opens" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "segment" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "scheduledAt" TIMESTAMP(3),
    "fromName" TEXT,
    "replyTo" TEXT,
    "preheader" TEXT,
    "audienceType" TEXT,
    "audienceValue" TEXT,
    "createdBy" TEXT,
    "subjectB" TEXT,
    "abSamplePct" INTEGER,
    "abDecideAt" TIMESTAMP(3),
    "abWinner" TEXT,
    "sentAt" TIMESTAMP(3),
    "recipients" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailLinkClick" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT,
    "url" TEXT NOT NULL,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailLinkClick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT,
    "preheader" TEXT,
    "fromName" TEXT,
    "body" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "onboardedAt" TIMESTAMP(3),
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'STAFF',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "permGrant" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "permRevoke" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isClinician" BOOLEAN NOT NULL DEFAULT false,
    "title" TEXT,
    "color" TEXT,
    "competencies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "publicProfile" BOOLEAN NOT NULL DEFAULT false,
    "photoUrl" TEXT,
    "publicPhone" TEXT,
    "bio" TEXT,
    "yearsExperience" INTEGER,
    "credentials" TEXT,
    "profileOrder" INTEGER NOT NULL DEFAULT 0,
    "googleCalendarId" TEXT,
    "googleRefreshToken" TEXT,
    "googleSub" TEXT,
    "googleEmail" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "preferredDashboardView" TEXT,
    "notifPrefs" JSONB,
    "totpSecret" TEXT,
    "totpEnabledAt" TIMESTAMP(3),
    "recoveryCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sessionEpoch" INTEGER NOT NULL DEFAULT 0,
    "financePinHash" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "TimeEntryKind" NOT NULL DEFAULT 'SHIFT',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacilityDoc" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "FacilityDocType" NOT NULL DEFAULT 'OTHER',
    "fileUrl" TEXT NOT NULL,
    "isPdf" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "locationId" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "FacilityDoc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractorTask" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "ContractorTaskStatus" NOT NULL DEFAULT 'OPEN',
    "assigneeId" TEXT,
    "contractorId" TEXT,
    "dueAt" TIMESTAMP(3),
    "locationId" TEXT,
    "createdBy" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractorTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contractor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "company" TEXT,
    "tradeType" TEXT,
    "status" "ContractorStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contractor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractorVisit" (
    "id" TEXT NOT NULL,
    "contractorId" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "checkedInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkedOutAt" TIMESTAMP(3),
    "locationId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractorVisit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebAuthnCredential" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "publicKey" BYTEA NOT NULL,
    "counter" INTEGER NOT NULL DEFAULT 0,
    "transports" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "deviceName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "WebAuthnCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffPoints" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "category" "PointsCategory" NOT NULL,
    "reason" TEXT NOT NULL,
    "bookingId" TEXT,
    "reviewId" TEXT,
    "awardedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffPoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reward" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "costPoints" INTEGER NOT NULL,
    "emoji" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "stock" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardRedemption" (
    "id" TEXT NOT NULL,
    "rewardId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "costPoints" INTEGER NOT NULL,
    "status" "RedemptionStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "decidedBy" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RewardRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "addressLine" TEXT,
    "city" TEXT,
    "postcode" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "color" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffSchedule" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startMin" INTEGER NOT NULL,
    "endMin" INTEGER NOT NULL,
    "breakStartMin" INTEGER,
    "breakEndMin" INTEGER,
    "locationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicClosure" (
    "id" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "allDay" BOOLEAN NOT NULL DEFAULT true,
    "reason" TEXT,
    "locationId" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClinicClosure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Resource" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "ResourceKind" NOT NULL DEFAULT 'EQUIPMENT',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "floor" TEXT,
    "capacity" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "locationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Resource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomPrep" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "RoomPrepStatus" NOT NULL DEFAULT 'DIRTY',
    "cleanedAt" TIMESTAMP(3),
    "cleanedBy" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomPrep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffTimeOff" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "kind" "TimeOffKind" NOT NULL DEFAULT 'BLOCKED',
    "status" "TimeOffStatus" NOT NULL DEFAULT 'APPROVED',
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "requestedBy" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "gcalEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffTimeOff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "seq" SERIAL NOT NULL,
    "ref" TEXT,
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "TaskPriority" NOT NULL DEFAULT 'NORMAL',
    "dueAt" TIMESTAMP(3),
    "assigneeId" TEXT,
    "clientId" TEXT,
    "parentId" TEXT,
    "createdBy" TEXT,
    "completedAt" TIMESTAMP(3),
    "completedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "brand" TEXT,
    "size" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'unit',
    "sku" TEXT,
    "supplier" TEXT,
    "moq" INTEGER NOT NULL DEFAULT 1,
    "currentQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lowStockAt" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "costPence" INTEGER,
    "retailPence" INTEGER,
    "isRetail" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "delta" DOUBLE PRECISION NOT NULL,
    "reason" "StockMoveReason" NOT NULL,
    "batchNo" TEXT,
    "expiry" TIMESTAMP(3),
    "bookingId" TEXT,
    "note" TEXT,
    "by" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalConnection" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "tokensEnc" TEXT NOT NULL,
    "accountRef" TEXT,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "ManagedSecret" (
    "name" TEXT NOT NULL,
    "valueEnc" TEXT NOT NULL,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManagedSecret_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "TreatmentSop" (
    "id" TEXT NOT NULL,
    "treatmentSlug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "TreatmentSop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "bookingId" TEXT,
    "clientId" TEXT,
    "actor" TEXT NOT NULL,
    "actorRole" TEXT,
    "summary" TEXT NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormQuestion" (
    "id" TEXT NOT NULL,
    "questionnaireKey" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "fieldType" TEXT NOT NULL DEFAULT 'text',
    "help" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "options" JSONB,
    "order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthAssessment" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "type" "AssessmentType" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "supersedesId" TEXT,
    "cipher" TEXT NOT NULL,
    "integrityHash" TEXT NOT NULL,
    "questionnaireKey" TEXT NOT NULL,
    "summary" JSONB,
    "sourceLocale" TEXT NOT NULL DEFAULT 'en',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedIp" TEXT,
    "bookingId" TEXT,

    CONSTRAINT "HealthAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscountClaim" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "DiscountStatus" NOT NULL DEFAULT 'ACTIVE',
    "percent" INTEGER NOT NULL DEFAULT 15,
    "emailNorm" TEXT NOT NULL,
    "phoneNorm" TEXT,
    "nameDobKey" TEXT,
    "ip" TEXT,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "reviewedBy" TEXT,
    "redeemedBookingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscountClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientPoints" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "category" "ClientPointsCategory" NOT NULL,
    "reason" TEXT NOT NULL,
    "bookingId" TEXT,
    "reviewId" TEXT,
    "referralId" TEXT,
    "awardedBy" TEXT NOT NULL DEFAULT 'system',
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientPoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembershipTier" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "minSpendPence" INTEGER NOT NULL DEFAULT 0,
    "pointsMultiplierBps" INTEGER NOT NULL DEFAULT 100,
    "birthdayBonusPoints" INTEGER NOT NULL DEFAULT 0,
    "earlyAccessHours" INTEGER NOT NULL DEFAULT 0,
    "retailDiscountPct" INTEGER NOT NULL DEFAULT 0,
    "perks" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "color" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MembershipTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Referral" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "referredId" TEXT,
    "referredEmail" TEXT,
    "status" "ReferralStatus" NOT NULL DEFAULT 'JOINED',
    "qualifiedAt" TIMESTAMP(3),
    "rewardedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "bookingId" TEXT,
    "clinicianId" TEXT,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "channel" "ReviewChannel" NOT NULL DEFAULT 'EMAIL',
    "token" TEXT NOT NULL,
    "rating" INTEGER,
    "title" TEXT,
    "body" TEXT,
    "treatmentTitle" TEXT,
    "displayConsent" BOOLEAN NOT NULL DEFAULT false,
    "moderatedBy" TEXT,
    "moderatedAt" TIMESTAMP(3),
    "googleReviewId" TEXT,
    "pushedToGoogleAt" TIMESTAMP(3),
    "redirectedToGoogle" BOOLEAN NOT NULL DEFAULT false,
    "requestedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoogleReview" (
    "id" TEXT NOT NULL,
    "googleName" TEXT NOT NULL,
    "reviewerName" TEXT,
    "reviewerPhoto" TEXT,
    "starRating" INTEGER NOT NULL,
    "comment" TEXT,
    "createTime" TIMESTAMP(3),
    "updateTime" TIMESTAMP(3),
    "replyComment" TEXT,
    "replyUpdateTime" TIMESTAMP(3),
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PageSeo" (
    "id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "canonical" TEXT,
    "focusKeyword" TEXT,
    "ogImage" TEXT,
    "noindex" BOOLEAN NOT NULL DEFAULT false,
    "jsonLd" JSONB,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PageSeo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "host" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademyStudent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "email" TEXT NOT NULL,
    "dob" TIMESTAMP(3),
    "ageDeclaredAt" TIMESTAMP(3),
    "goals" TEXT,
    "onboardedAt" TIMESTAMP(3),
    "phone" TEXT,
    "passwordHash" TEXT,
    "portalActive" BOOLEAN NOT NULL DEFAULT false,
    "sessionEpoch" INTEGER NOT NULL DEFAULT 0,
    "lastLoginAt" TIMESTAMP(3),
    "resetTokenHash" TEXT,
    "resetTokenExp" TIMESTAMP(3),
    "notes" TEXT,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademyStudent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentPasskey" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "studentId" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "publicKey" BYTEA NOT NULL,
    "counter" INTEGER NOT NULL DEFAULT 0,
    "transports" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "deviceName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "StudentPasskey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "level" TEXT,
    "summary" TEXT,
    "description" TEXT,
    "pricePence" INTEGER NOT NULL DEFAULT 0,
    "depositPence" INTEGER,
    "durationText" TEXT,
    "format" TEXT,
    "accreditations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "outcomes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "objectives" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "welcome" TEXT,
    "preCourseInfo" TEXT,
    "prerequisites" TEXT,
    "thinkificUrl" TEXT,
    "heroImage" TEXT,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseModule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lesson" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "moduleId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "durationMin" INTEGER,
    "videoUrl" TEXT,
    "imageUrl" TEXT,
    "body" TEXT NOT NULL,
    "keyPoints" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "objectives" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "studyTips" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "homework" TEXT,
    "requiresHomework" BOOLEAN NOT NULL DEFAULT false,
    "examRefs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "steps" JSONB,
    "minSeconds" INTEGER,
    "citations" JSONB,
    "resources" JSONB,
    "pdfUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pdfNoDownload" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomeworkSubmission" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "studentId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "files" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "note" TEXT,
    "status" "HomeworkStatus" NOT NULL DEFAULT 'SUBMITTED',
    "feedback" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomeworkSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quiz" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "moduleId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "passMark" INTEGER NOT NULL DEFAULT 70,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quiz_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizQuestion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "quizId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "prompt" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'SINGLE',
    "options" JSONB NOT NULL,
    "correct" JSONB NOT NULL,
    "explanation" TEXT,
    "tip" TEXT,
    "imageUrl" TEXT,

    CONSTRAINT "QuizQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonProgress" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "studentId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "secondsSpent" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LessonProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizAttempt" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "studentId" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "scorePct" INTEGER NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "answers" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuizAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamQuestion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "courseId" TEXT,
    "topic" TEXT,
    "difficulty" TEXT NOT NULL DEFAULT 'STANDARD',
    "examBoard" TEXT,
    "prompt" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'SINGLE',
    "options" JSONB NOT NULL,
    "correct" JSONB NOT NULL,
    "explanation" TEXT,
    "tip" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PastPaper" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "courseId" TEXT,
    "title" TEXT NOT NULL,
    "examBoard" TEXT,
    "year" INTEGER,
    "description" TEXT,
    "fileUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PastPaper_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PracticeAttempt" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "studentId" TEXT NOT NULL,
    "courseId" TEXT,
    "topic" TEXT,
    "total" INTEGER NOT NULL,
    "correct" INTEGER NOT NULL,
    "scorePct" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PracticeAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PointEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "studentId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "courseId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PointEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentBadge" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "studentId" TEXT NOT NULL,
    "badgeKey" TEXT NOT NULL,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentBadge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyActivity" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "studentId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "tasks" INTEGER NOT NULL DEFAULT 0,
    "boxOpened" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveClass" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "joinUrl" TEXT,
    "trainer" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiveClass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cohort" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "courseId" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "accessStartAt" TIMESTAMP(3),
    "accessEndAt" TIMESTAMP(3),
    "capacity" INTEGER NOT NULL DEFAULT 8,
    "location" TEXT,
    "trainer" TEXT,
    "status" "CohortStatus" NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cohort_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Enrolment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "courseId" TEXT NOT NULL,
    "cohortId" TEXT,
    "studentId" TEXT,
    "applicantName" TEXT NOT NULL,
    "applicantEmail" TEXT NOT NULL,
    "applicantPhone" TEXT,
    "experience" TEXT,
    "financeInterest" BOOLEAN NOT NULL DEFAULT false,
    "status" "EnrolmentStatus" NOT NULL DEFAULT 'APPLIED',
    "pricePence" INTEGER NOT NULL DEFAULT 0,
    "paidPence" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "preCourseAckAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Enrolment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FundingApplication" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "courseId" TEXT,
    "courseLevel" TEXT,
    "route" TEXT NOT NULL,
    "eligibleRoutes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "age19Plus" BOOLEAN,
    "residencyOk" BOOLEAN,
    "londonResident" BOOLEAN,
    "islingtonResident" BOOLEAN,
    "employmentStatus" TEXT,
    "lowIncome" BOOLEAN,
    "priorLevel3" BOOLEAN,
    "message" TEXT,
    "status" "FundingStatus" NOT NULL DEFAULT 'NEW',
    "notes" TEXT,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FundingApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FollowUp" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "treatmentTitle" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "sentiment" TEXT,
    "concern" BOOLEAN NOT NULL DEFAULT false,
    "comment" TEXT,
    "taskId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiAnalysis" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "areas" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "model" TEXT,
    "status" TEXT NOT NULL DEFAULT 'complete',
    "confidence" DOUBLE PRECISION,
    "needsExpert" BOOLEAN NOT NULL DEFAULT false,
    "budgetPence" INTEGER,
    "findingsEnc" TEXT,
    "planJson" JSONB,
    "recommendedSlugs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "summary" TEXT,
    "tokensIn" INTEGER,
    "tokensOut" INTEGER,
    "consentAt" TIMESTAMP(3),
    "storeImages" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiAnalysisImage" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "area" TEXT,
    "dataEnc" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiAnalysisImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vacancy" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "department" TEXT,
    "location" TEXT,
    "type" TEXT,
    "summary" TEXT,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vacancy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobApplication" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "vacancyId" TEXT,
    "roleTitle" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "coverNote" TEXT,
    "cvUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GiftVoucher" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "amountPence" INTEGER NOT NULL,
    "balancePence" INTEGER NOT NULL,
    "purchaserName" TEXT NOT NULL,
    "purchaserEmail" TEXT NOT NULL,
    "recipientName" TEXT,
    "recipientEmail" TEXT,
    "message" TEXT,
    "design" TEXT,
    "packageSlug" TEXT,
    "packageName" TEXT,
    "deliverAt" TIMESTAMP(3),
    "delivered" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "physical" BOOLEAN NOT NULL DEFAULT false,
    "physicalFeePence" INTEGER NOT NULL DEFAULT 0,
    "fulfillment" TEXT NOT NULL DEFAULT 'none',
    "shipName" TEXT,
    "shipLine1" TEXT,
    "shipLine2" TEXT,
    "shipCity" TEXT,
    "shipPostcode" TEXT,
    "postedAt" TIMESTAMP(3),
    "stripePaymentIntentId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "claimedByClientId" TEXT,
    "claimedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GiftVoucher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsletterSubscriber" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "source" TEXT,
    "consentedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unsubToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsletterSubscriber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GalleryItem" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "treatmentSlug" TEXT,
    "caption" TEXT,
    "beforeImage" BYTEA NOT NULL,
    "beforeType" TEXT NOT NULL DEFAULT 'image/jpeg',
    "afterImage" BYTEA NOT NULL,
    "afterType" TEXT NOT NULL DEFAULT 'image/jpeg',
    "published" BOOLEAN NOT NULL DEFAULT false,
    "consent" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GalleryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "portal" TEXT NOT NULL,
    "identifier" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromoCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'UNIVERSAL',
    "discountType" TEXT NOT NULL DEFAULT 'PERCENT',
    "percent" INTEGER,
    "amountPence" INTEGER,
    "treatmentSlugs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "minSpendPence" INTEGER,
    "maxRedemptions" INTEGER,
    "redeemedCount" INTEGER NOT NULL DEFAULT 0,
    "oncePerClient" BOOLEAN NOT NULL DEFAULT true,
    "assignedEmail" TEXT,
    "campaignId" TEXT,
    "label" TEXT,
    "startsAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromoCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromoRedemption" (
    "id" TEXT NOT NULL,
    "promoCodeId" TEXT NOT NULL,
    "clientId" TEXT,
    "email" TEXT,
    "bookingId" TEXT,
    "amountOffPence" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromoRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatConversation" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "visitorName" TEXT,
    "visitorEmail" TEXT,
    "clientId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "mode" TEXT NOT NULL DEFAULT 'AI',
    "staffUnread" INTEGER NOT NULL DEFAULT 0,
    "page" TEXT,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastVisitorSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "author" TEXT,
    "authorName" TEXT,
    "authorTitle" TEXT,
    "authorId" TEXT,
    "authorPublic" BOOLEAN NOT NULL DEFAULT false,
    "body" TEXT NOT NULL,
    "via" TEXT NOT NULL DEFAULT 'chat',
    "emailedAt" TIMESTAMP(3),
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT,
    "metaDescription" TEXT,
    "content" TEXT NOT NULL,
    "blocks" JSONB,
    "category" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "related" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "coverImage" TEXT,
    "readMinutes" INTEGER NOT NULL DEFAULT 5,
    "status" "PostStatus" NOT NULL DEFAULT 'DRAFT',
    "source" TEXT,
    "authorName" TEXT DEFAULT 'The KClinics team',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteConfig" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "data" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "SiteConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Page" (
    "id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "title" TEXT,
    "draft" JSONB NOT NULL,
    "published" JSONB,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "publishAt" TIMESTAMP(3),
    "unpublishAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "Page_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GlobalSection" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "GlobalSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PageRevision" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "PageRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TreatmentContent" (
    "slug" TEXT NOT NULL,
    "title" TEXT,
    "tagline" TEXT,
    "eyebrow" TEXT,
    "intro" TEXT,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "priceFrom" TEXT,
    "benefits" JSONB,
    "process" JSONB,
    "faqs" JSONB,
    "facts" JSONB,
    "related" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "TreatmentContent_pkey" PRIMARY KEY ("slug")
);

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "pathname" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "alt" TEXT,
    "mime" TEXT,
    "size" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "folder" TEXT DEFAULT 'general',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteConfigRevision" (
    "id" TEXT NOT NULL,
    "configId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "SiteConfigRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QrCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "scanCount" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QrCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QrScan" (
    "id" TEXT NOT NULL,
    "qrCodeId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "device" TEXT,
    "referer" TEXT,
    "country" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "QrScan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Redirect" (
    "id" TEXT NOT NULL,
    "fromPath" TEXT NOT NULL,
    "toUrl" TEXT NOT NULL,
    "code" INTEGER NOT NULL DEFAULT 301,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Redirect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AbTest" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "AbStatus" NOT NULL DEFAULT 'DRAFT',
    "goal" TEXT NOT NULL DEFAULT 'cta_click',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AbTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AbVariant" (
    "id" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "headline" TEXT,
    "subhead" TEXT,
    "ctaLabel" TEXT,
    "ctaHref" TEXT,
    "exposures" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AbVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReplaySession" (
    "id" TEXT NOT NULL,
    "sessionKey" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "device" TEXT,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "eventCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReplaySession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReplayChunk" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "events" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReplayChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HeatmapEvent" (
    "id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "xPct" INTEGER NOT NULL DEFAULT 0,
    "yPct" INTEGER NOT NULL DEFAULT 0,
    "scrollPct" INTEGER NOT NULL DEFAULT 0,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HeatmapEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Segment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "rules" JSONB NOT NULL,
    "metaAudienceId" TEXT,
    "metaSyncedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Segment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentTemplate" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "version" INTEGER NOT NULL DEFAULT 1,
    "bodyMd" TEXT NOT NULL,
    "acknowledgements" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "serviceSlugs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "serviceGroups" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsentTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentRequest" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "bookingId" TEXT,
    "templateKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'treatment',
    "status" "ConsentStatus" NOT NULL DEFAULT 'PENDING',
    "signedConsentId" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "ConsentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignedConsent" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "bookingId" TEXT,
    "templateKey" TEXT NOT NULL,
    "templateVersion" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'treatment',
    "declined" BOOLEAN NOT NULL DEFAULT false,
    "signerName" TEXT NOT NULL,
    "cipher" TEXT NOT NULL,
    "integrityHash" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignedConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BeforePhoto" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "area" TEXT,
    "dataEnc" TEXT NOT NULL,
    "capturedBy" TEXT NOT NULL,
    "attestation" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BeforePhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "brand" TEXT,
    "category" TEXT,
    "pricePence" INTEGER NOT NULL DEFAULT 0,
    "compareAtPence" INTEGER,
    "costPence" INTEGER,
    "sku" TEXT,
    "barcode" TEXT,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "ProductStatus" NOT NULL DEFAULT 'DRAFT',
    "ageRestricted" BOOLEAN NOT NULL DEFAULT false,
    "trackInventory" BOOLEAN NOT NULL DEFAULT true,
    "stockQty" INTEGER NOT NULL DEFAULT 0,
    "lowStockThreshold" INTEGER NOT NULL DEFAULT 5,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "clientId" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "method" TEXT NOT NULL DEFAULT 'ship',
    "shipName" TEXT,
    "shipLine1" TEXT,
    "shipLine2" TEXT,
    "shipCity" TEXT,
    "shipPostcode" TEXT,
    "subtotalPence" INTEGER NOT NULL,
    "shippingPence" INTEGER NOT NULL DEFAULT 0,
    "giftCardCode" TEXT,
    "giftCardPence" INTEGER NOT NULL DEFAULT 0,
    "totalPence" INTEGER NOT NULL,
    "ageVerified" BOOLEAN NOT NULL DEFAULT false,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "fulfillment" TEXT NOT NULL DEFAULT 'unfulfilled',
    "trackingNote" TEXT,
    "stripePaymentIntentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "unitPence" INTEGER NOT NULL,
    "qty" INTEGER NOT NULL,
    "ageRestricted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DayClose" (
    "id" TEXT NOT NULL,
    "locationId" TEXT,
    "businessDate" TIMESTAMP(3) NOT NULL,
    "status" "DayCloseStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "expectedCardPence" INTEGER NOT NULL DEFAULT 0,
    "countedCardPence" INTEGER,
    "floatOpenPence" INTEGER NOT NULL DEFAULT 0,
    "cashCountedPence" INTEGER,
    "cashTakingsPence" INTEGER,
    "variancePence" INTEGER,
    "checklistDone" INTEGER NOT NULL DEFAULT 0,
    "checklistTotal" INTEGER NOT NULL DEFAULT 0,
    "payload" JSONB,
    "notes" TEXT,
    "startedBy" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedBy" TEXT,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "DayClose_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuildItem" (
    "id" TEXT NOT NULL,
    "seq" SERIAL NOT NULL,
    "ref" TEXT,
    "type" "BuildType" NOT NULL DEFAULT 'TASK',
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "status" "BuildStatus" NOT NULL DEFAULT 'TRIAGE',
    "urgency" "BuildUrgency" NOT NULL DEFAULT 'P2',
    "assignee" TEXT NOT NULL DEFAULT 'claude',
    "reportedBy" TEXT,
    "pageUrl" TEXT,
    "screenshots" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "attachments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "blocker" TEXT,
    "githubUrl" TEXT,
    "githubNumber" INTEGER,
    "githubClosed" BOOLEAN NOT NULL DEFAULT false,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "value" INTEGER,
    "effort" INTEGER,
    "startedAt" TIMESTAMP(3),
    "estCompleteAt" TIMESTAMP(3),
    "estTokens" INTEGER,
    "actualTokens" INTEGER,
    "signoffRequired" BOOLEAN NOT NULL DEFAULT true,
    "shippedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "closedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "projectId" TEXT,

    CONSTRAINT "BuildItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuildProject" (
    "id" TEXT NOT NULL,
    "seq" SERIAL NOT NULL,
    "ref" TEXT,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "summary" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "originIdeaTitle" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuildProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuildDependency" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "dependsOnId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuildDependency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuildSubtask" (
    "id" TEXT NOT NULL,
    "ref" TEXT,
    "itemId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'TODO',
    "assignee" TEXT NOT NULL DEFAULT 'claude',
    "ownerInput" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "completedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuildSubtask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuildEvent" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "body" TEXT,
    "actor" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuildEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NpsResponse" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "clientId" TEXT,
    "bookingId" TEXT,
    "treatment" TEXT,
    "score" INTEGER,
    "comment" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "NpsResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceWindow" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "services" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "impact" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenanceWindow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffNotification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "category" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "groupKey" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "href" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "ua" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KioskSession" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "secret" TEXT,
    "status" "KioskStatus" NOT NULL DEFAULT 'ACTIVE',
    "ipHash" TEXT,
    "photoUrl" TEXT,
    "consentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'idle',
    "poseIdx" INTEGER NOT NULL DEFAULT 0,
    "photoUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "liveFrame" TEXT,
    "liveFrameAt" TIMESTAMP(3),
    "ageDeclaredAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locationId" TEXT,

    CONSTRAINT "KioskSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KioskResult" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "skinScore" INTEGER NOT NULL,
    "smileScore" INTEGER NOT NULL,
    "insights" TEXT[],
    "treatments" TEXT[],
    "photoUrl" TEXT,
    "shareSlug" TEXT NOT NULL,
    "shareCount" INTEGER NOT NULL DEFAULT 0,
    "annotations" JSONB,
    "shareCaption" TEXT,
    "bestPhotoUrl" TEXT,
    "claimCode" TEXT,
    "claimEmail" TEXT,
    "claimedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KioskResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KioskEvent" (
    "id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "sessionId" TEXT,
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KioskEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "DeviceKind" NOT NULL DEFAULT 'TERMINAL',
    "provider" TEXT,
    "externalId" TEXT,
    "location" TEXT,
    "station" TEXT,
    "roomId" TEXT,
    "token" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionnaireVersion" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "intro" TEXT,
    "questions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "QuestionnaireVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomClosure" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "createdBy" TEXT,
    "endedEarlyAt" TIMESTAMP(3),
    "endedEarlyBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomClosure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaitlistEntry" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "treatmentSlug" TEXT NOT NULL,
    "treatmentTitle" TEXT NOT NULL,
    "fromDate" TIMESTAMP(3) NOT NULL,
    "toDate" TIMESTAMP(3) NOT NULL,
    "status" "WaitlistStatus" NOT NULL DEFAULT 'ACTIVE',
    "claimToken" TEXT,
    "offeredStart" TIMESTAMP(3),
    "notifiedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_BookingToResource" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_BookingToResource_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_StaffLocations" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_StaffLocations_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_RoomEquipment" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_RoomEquipment_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "CashflowEntry_active_idx" ON "CashflowEntry"("active");

-- CreateIndex
CREATE UNIQUE INDEX "Client_email_key" ON "Client"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Client_unsubToken_key" ON "Client"("unsubToken");

-- CreateIndex
CREATE UNIQUE INDEX "Client_stripeCustomerId_key" ON "Client"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "Client_referralCode_key" ON "Client"("referralCode");

-- CreateIndex
CREATE INDEX "Client_createdAt_idx" ON "Client"("createdAt");

-- CreateIndex
CREATE INDEX "Client_dob_idx" ON "Client"("dob");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_xeroContactId_key" ON "Supplier"("xeroContactId");

-- CreateIndex
CREATE INDEX "Supplier_active_idx" ON "Supplier"("active");

-- CreateIndex
CREATE INDEX "Supplier_phone_idx" ON "Supplier"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "CallRecord_yayId_key" ON "CallRecord"("yayId");

-- CreateIndex
CREATE INDEX "CallRecord_startedAt_idx" ON "CallRecord"("startedAt");

-- CreateIndex
CREATE INDEX "CallRecord_direction_idx" ON "CallRecord"("direction");

-- CreateIndex
CREATE INDEX "CallRecord_matchedClientId_idx" ON "CallRecord"("matchedClientId");

-- CreateIndex
CREATE INDEX "Consultation_status_idx" ON "Consultation"("status");

-- CreateIndex
CREATE INDEX "Consultation_createdAt_idx" ON "Consultation"("createdAt");

-- CreateIndex
CREATE INDEX "ConsultationNote_consultationId_createdAt_idx" ON "ConsultationNote"("consultationId", "createdAt");

-- CreateIndex
CREATE INDEX "Interaction_clientId_createdAt_idx" ON "Interaction"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "Interaction_clientId_pinned_idx" ON "Interaction"("clientId", "pinned");

-- CreateIndex
CREATE INDEX "Appointment_scheduledAt_idx" ON "Appointment"("scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_manageToken_key" ON "Booking"("manageToken");

-- CreateIndex
CREATE INDEX "Booking_startAt_idx" ON "Booking"("startAt");

-- CreateIndex
CREATE INDEX "Booking_status_idx" ON "Booking"("status");

-- CreateIndex
CREATE INDEX "Booking_clientId_idx" ON "Booking"("clientId");

-- CreateIndex
CREATE INDEX "Booking_practitionerId_idx" ON "Booking"("practitionerId");

-- CreateIndex
CREATE INDEX "Booking_marketingCampaignId_idx" ON "Booking"("marketingCampaignId");

-- CreateIndex
CREATE UNIQUE INDEX "AppointmentSession_bookingId_key" ON "AppointmentSession"("bookingId");

-- CreateIndex
CREATE INDEX "AppointmentSession_startedAt_idx" ON "AppointmentSession"("startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingCampaign_slug_key" ON "MarketingCampaign"("slug");

-- CreateIndex
CREATE INDEX "MarketingCampaign_status_idx" ON "MarketingCampaign"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Service_slug_key" ON "Service"("slug");

-- CreateIndex
CREATE INDEX "Service_treatmentSlug_idx" ON "Service"("treatmentSlug");

-- CreateIndex
CREATE INDEX "Service_active_idx" ON "Service"("active");

-- CreateIndex
CREATE INDEX "ServiceVariant_serviceId_active_idx" ON "ServiceVariant"("serviceId", "active");

-- CreateIndex
CREATE INDEX "ServiceOffer_active_promoted_idx" ON "ServiceOffer"("active", "promoted");

-- CreateIndex
CREATE INDEX "ServiceOffer_serviceId_idx" ON "ServiceOffer"("serviceId");

-- CreateIndex
CREATE INDEX "ServiceOffer_variantId_idx" ON "ServiceOffer"("variantId");

-- CreateIndex
CREATE INDEX "BookingItem_bookingId_idx" ON "BookingItem"("bookingId");

-- CreateIndex
CREATE INDEX "EmailEvent_clientId_idx" ON "EmailEvent"("clientId");

-- CreateIndex
CREATE INDEX "EmailEvent_kind_createdAt_idx" ON "EmailEvent"("kind", "createdAt");

-- CreateIndex
CREATE INDEX "EmailEvent_campaignId_idx" ON "EmailEvent"("campaignId");

-- CreateIndex
CREATE INDEX "EmailEvent_providerId_idx" ON "EmailEvent"("providerId");

-- CreateIndex
CREATE INDEX "Campaign_status_scheduledAt_idx" ON "Campaign"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "EmailLinkClick_campaignId_idx" ON "EmailLinkClick"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailLinkClick_campaignId_url_key" ON "EmailLinkClick"("campaignId", "url");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- CreateIndex
CREATE INDEX "TimeEntry_userId_startedAt_idx" ON "TimeEntry"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "TimeEntry_userId_endedAt_idx" ON "TimeEntry"("userId", "endedAt");

-- CreateIndex
CREATE INDEX "FacilityDoc_type_order_idx" ON "FacilityDoc"("type", "order");

-- CreateIndex
CREATE INDEX "FacilityDoc_locationId_idx" ON "FacilityDoc"("locationId");

-- CreateIndex
CREATE INDEX "ContractorTask_assigneeId_status_idx" ON "ContractorTask"("assigneeId", "status");

-- CreateIndex
CREATE INDEX "ContractorTask_contractorId_status_idx" ON "ContractorTask"("contractorId", "status");

-- CreateIndex
CREATE INDEX "ContractorTask_status_dueAt_idx" ON "ContractorTask"("status", "dueAt");

-- CreateIndex
CREATE INDEX "Contractor_status_idx" ON "Contractor"("status");

-- CreateIndex
CREATE INDEX "Contractor_email_idx" ON "Contractor"("email");

-- CreateIndex
CREATE INDEX "ContractorVisit_contractorId_checkedInAt_idx" ON "ContractorVisit"("contractorId", "checkedInAt");

-- CreateIndex
CREATE UNIQUE INDEX "WebAuthnCredential_credentialId_key" ON "WebAuthnCredential"("credentialId");

-- CreateIndex
CREATE INDEX "WebAuthnCredential_adminUserId_idx" ON "WebAuthnCredential"("adminUserId");

-- CreateIndex
CREATE INDEX "StaffPoints_staffId_createdAt_idx" ON "StaffPoints"("staffId", "createdAt");

-- CreateIndex
CREATE INDEX "StaffPoints_category_idx" ON "StaffPoints"("category");

-- CreateIndex
CREATE INDEX "Reward_active_sortOrder_idx" ON "Reward"("active", "sortOrder");

-- CreateIndex
CREATE INDEX "RewardRedemption_staffId_createdAt_idx" ON "RewardRedemption"("staffId", "createdAt");

-- CreateIndex
CREATE INDEX "RewardRedemption_status_idx" ON "RewardRedemption"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Location_slug_key" ON "Location"("slug");

-- CreateIndex
CREATE INDEX "Location_active_idx" ON "Location"("active");

-- CreateIndex
CREATE INDEX "StaffSchedule_staffId_dayOfWeek_idx" ON "StaffSchedule"("staffId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "ClinicClosure_startAt_endAt_idx" ON "ClinicClosure"("startAt", "endAt");

-- CreateIndex
CREATE INDEX "Resource_slug_active_idx" ON "Resource"("slug", "active");

-- CreateIndex
CREATE INDEX "Resource_kind_active_idx" ON "Resource"("kind", "active");

-- CreateIndex
CREATE INDEX "RoomPrep_date_status_idx" ON "RoomPrep"("date", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RoomPrep_roomId_date_key" ON "RoomPrep"("roomId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "StaffTimeOff_gcalEventId_key" ON "StaffTimeOff"("gcalEventId");

-- CreateIndex
CREATE INDEX "StaffTimeOff_staffId_startAt_idx" ON "StaffTimeOff"("staffId", "startAt");

-- CreateIndex
CREATE INDEX "StaffTimeOff_startAt_endAt_idx" ON "StaffTimeOff"("startAt", "endAt");

-- CreateIndex
CREATE INDEX "StaffTimeOff_status_idx" ON "StaffTimeOff"("status");

-- CreateIndex
CREATE INDEX "Task_status_idx" ON "Task"("status");

-- CreateIndex
CREATE INDEX "Task_assigneeId_status_idx" ON "Task"("assigneeId", "status");

-- CreateIndex
CREATE INDEX "Task_dueAt_idx" ON "Task"("dueAt");

-- CreateIndex
CREATE INDEX "Task_parentId_idx" ON "Task"("parentId");

-- CreateIndex
CREATE INDEX "StockItem_active_idx" ON "StockItem"("active");

-- CreateIndex
CREATE INDEX "StockMovement_itemId_createdAt_idx" ON "StockMovement"("itemId", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_expiry_idx" ON "StockMovement"("expiry");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalConnection_provider_key" ON "ExternalConnection"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "TreatmentSop_treatmentSlug_key" ON "TreatmentSop"("treatmentSlug");

-- CreateIndex
CREATE INDEX "AuditEvent_bookingId_createdAt_idx" ON "AuditEvent"("bookingId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_clientId_createdAt_idx" ON "AuditEvent"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_createdAt_idx" ON "AuditEvent"("createdAt");

-- CreateIndex
CREATE INDEX "FormQuestion_questionnaireKey_active_order_idx" ON "FormQuestion"("questionnaireKey", "active", "order");

-- CreateIndex
CREATE UNIQUE INDEX "HealthAssessment_supersedesId_key" ON "HealthAssessment"("supersedesId");

-- CreateIndex
CREATE INDEX "HealthAssessment_clientId_type_idx" ON "HealthAssessment"("clientId", "type");

-- CreateIndex
CREATE INDEX "HealthAssessment_submittedAt_idx" ON "HealthAssessment"("submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DiscountClaim_code_key" ON "DiscountClaim"("code");

-- CreateIndex
CREATE INDEX "DiscountClaim_emailNorm_idx" ON "DiscountClaim"("emailNorm");

-- CreateIndex
CREATE INDEX "DiscountClaim_phoneNorm_idx" ON "DiscountClaim"("phoneNorm");

-- CreateIndex
CREATE INDEX "DiscountClaim_nameDobKey_idx" ON "DiscountClaim"("nameDobKey");

-- CreateIndex
CREATE INDEX "DiscountClaim_status_idx" ON "DiscountClaim"("status");

-- CreateIndex
CREATE INDEX "ClientPoints_clientId_idx" ON "ClientPoints"("clientId");

-- CreateIndex
CREATE INDEX "ClientPoints_clientId_category_idx" ON "ClientPoints"("clientId", "category");

-- CreateIndex
CREATE INDEX "ClientPoints_expiresAt_idx" ON "ClientPoints"("expiresAt");

-- CreateIndex
CREATE INDEX "ClientPoints_bookingId_idx" ON "ClientPoints"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "MembershipTier_key_key" ON "MembershipTier"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Referral_referredId_key" ON "Referral"("referredId");

-- CreateIndex
CREATE INDEX "Referral_referrerId_idx" ON "Referral"("referrerId");

-- CreateIndex
CREATE INDEX "Referral_status_idx" ON "Referral"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Review_token_key" ON "Review"("token");

-- CreateIndex
CREATE INDEX "Review_status_idx" ON "Review"("status");

-- CreateIndex
CREATE INDEX "Review_clientId_idx" ON "Review"("clientId");

-- CreateIndex
CREATE INDEX "Review_clinicianId_idx" ON "Review"("clinicianId");

-- CreateIndex
CREATE INDEX "Review_rating_idx" ON "Review"("rating");

-- CreateIndex
CREATE UNIQUE INDEX "GoogleReview_googleName_key" ON "GoogleReview"("googleName");

-- CreateIndex
CREATE INDEX "GoogleReview_starRating_idx" ON "GoogleReview"("starRating");

-- CreateIndex
CREATE INDEX "GoogleReview_createTime_idx" ON "GoogleReview"("createTime");

-- CreateIndex
CREATE UNIQUE INDEX "PageSeo_path_key" ON "PageSeo"("path");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_host_key" ON "Tenant"("host");

-- CreateIndex
CREATE UNIQUE INDEX "AcademyStudent_email_key" ON "AcademyStudent"("email");

-- CreateIndex
CREATE INDEX "AcademyStudent_createdAt_idx" ON "AcademyStudent"("createdAt");

-- CreateIndex
CREATE INDEX "AcademyStudent_xp_idx" ON "AcademyStudent"("xp");

-- CreateIndex
CREATE INDEX "AcademyStudent_tenantId_idx" ON "AcademyStudent"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentPasskey_credentialId_key" ON "StudentPasskey"("credentialId");

-- CreateIndex
CREATE INDEX "StudentPasskey_studentId_idx" ON "StudentPasskey"("studentId");

-- CreateIndex
CREATE INDEX "StudentPasskey_tenantId_idx" ON "StudentPasskey"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Course_slug_key" ON "Course"("slug");

-- CreateIndex
CREATE INDEX "Course_active_order_idx" ON "Course"("active", "order");

-- CreateIndex
CREATE INDEX "Course_tenantId_idx" ON "Course"("tenantId");

-- CreateIndex
CREATE INDEX "CourseModule_courseId_order_idx" ON "CourseModule"("courseId", "order");

-- CreateIndex
CREATE INDEX "CourseModule_tenantId_idx" ON "CourseModule"("tenantId");

-- CreateIndex
CREATE INDEX "Lesson_moduleId_order_idx" ON "Lesson"("moduleId", "order");

-- CreateIndex
CREATE INDEX "Lesson_tenantId_idx" ON "Lesson"("tenantId");

-- CreateIndex
CREATE INDEX "HomeworkSubmission_lessonId_status_idx" ON "HomeworkSubmission"("lessonId", "status");

-- CreateIndex
CREATE INDEX "HomeworkSubmission_studentId_idx" ON "HomeworkSubmission"("studentId");

-- CreateIndex
CREATE INDEX "HomeworkSubmission_tenantId_idx" ON "HomeworkSubmission"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Quiz_moduleId_key" ON "Quiz"("moduleId");

-- CreateIndex
CREATE INDEX "Quiz_tenantId_idx" ON "Quiz"("tenantId");

-- CreateIndex
CREATE INDEX "QuizQuestion_quizId_order_idx" ON "QuizQuestion"("quizId", "order");

-- CreateIndex
CREATE INDEX "QuizQuestion_tenantId_idx" ON "QuizQuestion"("tenantId");

-- CreateIndex
CREATE INDEX "LessonProgress_studentId_idx" ON "LessonProgress"("studentId");

-- CreateIndex
CREATE INDEX "LessonProgress_tenantId_idx" ON "LessonProgress"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "LessonProgress_studentId_lessonId_key" ON "LessonProgress"("studentId", "lessonId");

-- CreateIndex
CREATE INDEX "QuizAttempt_studentId_quizId_idx" ON "QuizAttempt"("studentId", "quizId");

-- CreateIndex
CREATE INDEX "QuizAttempt_tenantId_idx" ON "QuizAttempt"("tenantId");

-- CreateIndex
CREATE INDEX "ExamQuestion_courseId_active_idx" ON "ExamQuestion"("courseId", "active");

-- CreateIndex
CREATE INDEX "ExamQuestion_topic_idx" ON "ExamQuestion"("topic");

-- CreateIndex
CREATE INDEX "ExamQuestion_tenantId_idx" ON "ExamQuestion"("tenantId");

-- CreateIndex
CREATE INDEX "PastPaper_courseId_active_order_idx" ON "PastPaper"("courseId", "active", "order");

-- CreateIndex
CREATE INDEX "PastPaper_tenantId_idx" ON "PastPaper"("tenantId");

-- CreateIndex
CREATE INDEX "PracticeAttempt_studentId_idx" ON "PracticeAttempt"("studentId");

-- CreateIndex
CREATE INDEX "PracticeAttempt_courseId_idx" ON "PracticeAttempt"("courseId");

-- CreateIndex
CREATE INDEX "PracticeAttempt_tenantId_idx" ON "PracticeAttempt"("tenantId");

-- CreateIndex
CREATE INDEX "PointEvent_studentId_createdAt_idx" ON "PointEvent"("studentId", "createdAt");

-- CreateIndex
CREATE INDEX "PointEvent_tenantId_idx" ON "PointEvent"("tenantId");

-- CreateIndex
CREATE INDEX "StudentBadge_studentId_idx" ON "StudentBadge"("studentId");

-- CreateIndex
CREATE INDEX "StudentBadge_tenantId_idx" ON "StudentBadge"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentBadge_studentId_badgeKey_key" ON "StudentBadge"("studentId", "badgeKey");

-- CreateIndex
CREATE INDEX "DailyActivity_studentId_idx" ON "DailyActivity"("studentId");

-- CreateIndex
CREATE INDEX "DailyActivity_tenantId_idx" ON "DailyActivity"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyActivity_studentId_day_key" ON "DailyActivity"("studentId", "day");

-- CreateIndex
CREATE INDEX "LiveClass_courseId_startAt_idx" ON "LiveClass"("courseId", "startAt");

-- CreateIndex
CREATE INDEX "LiveClass_tenantId_idx" ON "LiveClass"("tenantId");

-- CreateIndex
CREATE INDEX "Cohort_courseId_startAt_idx" ON "Cohort"("courseId", "startAt");

-- CreateIndex
CREATE INDEX "Cohort_tenantId_idx" ON "Cohort"("tenantId");

-- CreateIndex
CREATE INDEX "Enrolment_status_idx" ON "Enrolment"("status");

-- CreateIndex
CREATE INDEX "Enrolment_courseId_idx" ON "Enrolment"("courseId");

-- CreateIndex
CREATE INDEX "Enrolment_applicantEmail_idx" ON "Enrolment"("applicantEmail");

-- CreateIndex
CREATE INDEX "Enrolment_tenantId_idx" ON "Enrolment"("tenantId");

-- CreateIndex
CREATE INDEX "FundingApplication_status_idx" ON "FundingApplication"("status");

-- CreateIndex
CREATE INDEX "FundingApplication_email_idx" ON "FundingApplication"("email");

-- CreateIndex
CREATE INDEX "FundingApplication_tenantId_idx" ON "FundingApplication"("tenantId");

-- CreateIndex
CREATE INDEX "FundingApplication_createdAt_idx" ON "FundingApplication"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FollowUp_bookingId_key" ON "FollowUp"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "FollowUp_token_key" ON "FollowUp"("token");

-- CreateIndex
CREATE INDEX "FollowUp_clientId_idx" ON "FollowUp"("clientId");

-- CreateIndex
CREATE INDEX "FollowUp_respondedAt_idx" ON "FollowUp"("respondedAt");

-- CreateIndex
CREATE INDEX "AiAnalysis_clientId_createdAt_idx" ON "AiAnalysis"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "AiAnalysisImage_analysisId_idx" ON "AiAnalysisImage"("analysisId");

-- CreateIndex
CREATE UNIQUE INDEX "Vacancy_slug_key" ON "Vacancy"("slug");

-- CreateIndex
CREATE INDEX "Vacancy_active_order_idx" ON "Vacancy"("active", "order");

-- CreateIndex
CREATE INDEX "Vacancy_tenantId_idx" ON "Vacancy"("tenantId");

-- CreateIndex
CREATE INDEX "JobApplication_status_idx" ON "JobApplication"("status");

-- CreateIndex
CREATE INDEX "JobApplication_vacancyId_idx" ON "JobApplication"("vacancyId");

-- CreateIndex
CREATE INDEX "JobApplication_tenantId_idx" ON "JobApplication"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "GiftVoucher_code_key" ON "GiftVoucher"("code");

-- CreateIndex
CREATE UNIQUE INDEX "GiftVoucher_stripePaymentIntentId_key" ON "GiftVoucher"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "GiftVoucher_status_idx" ON "GiftVoucher"("status");

-- CreateIndex
CREATE INDEX "GiftVoucher_delivered_deliverAt_idx" ON "GiftVoucher"("delivered", "deliverAt");

-- CreateIndex
CREATE INDEX "GiftVoucher_claimedByClientId_idx" ON "GiftVoucher"("claimedByClientId");

-- CreateIndex
CREATE UNIQUE INDEX "NewsletterSubscriber_email_key" ON "NewsletterSubscriber"("email");

-- CreateIndex
CREATE UNIQUE INDEX "NewsletterSubscriber_unsubToken_key" ON "NewsletterSubscriber"("unsubToken");

-- CreateIndex
CREATE INDEX "NewsletterSubscriber_active_idx" ON "NewsletterSubscriber"("active");

-- CreateIndex
CREATE INDEX "GalleryItem_published_order_idx" ON "GalleryItem"("published", "order");

-- CreateIndex
CREATE INDEX "SecurityEvent_type_createdAt_idx" ON "SecurityEvent"("type", "createdAt");

-- CreateIndex
CREATE INDEX "SecurityEvent_identifier_createdAt_idx" ON "SecurityEvent"("identifier", "createdAt");

-- CreateIndex
CREATE INDEX "SecurityEvent_ip_createdAt_idx" ON "SecurityEvent"("ip", "createdAt");

-- CreateIndex
CREATE INDEX "SecurityEvent_createdAt_idx" ON "SecurityEvent"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PromoCode_code_key" ON "PromoCode"("code");

-- CreateIndex
CREATE INDEX "PromoCode_active_expiresAt_idx" ON "PromoCode"("active", "expiresAt");

-- CreateIndex
CREATE INDEX "PromoCode_campaignId_idx" ON "PromoCode"("campaignId");

-- CreateIndex
CREATE INDEX "PromoCode_assignedEmail_idx" ON "PromoCode"("assignedEmail");

-- CreateIndex
CREATE INDEX "PromoRedemption_promoCodeId_idx" ON "PromoRedemption"("promoCodeId");

-- CreateIndex
CREATE INDEX "PromoRedemption_clientId_idx" ON "PromoRedemption"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatConversation_token_key" ON "ChatConversation"("token");

-- CreateIndex
CREATE INDEX "ChatConversation_status_lastMessageAt_idx" ON "ChatConversation"("status", "lastMessageAt");

-- CreateIndex
CREATE INDEX "ChatMessage_conversationId_createdAt_idx" ON "ChatMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "ChatMessage_externalId_idx" ON "ChatMessage"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Post_slug_key" ON "Post"("slug");

-- CreateIndex
CREATE INDEX "Post_status_publishedAt_idx" ON "Post"("status", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Page_path_key" ON "Page"("path");

-- CreateIndex
CREATE INDEX "Page_status_idx" ON "Page"("status");

-- CreateIndex
CREATE INDEX "PageRevision_pageId_createdAt_idx" ON "PageRevision"("pageId", "createdAt");

-- CreateIndex
CREATE INDEX "MediaAsset_createdAt_idx" ON "MediaAsset"("createdAt");

-- CreateIndex
CREATE INDEX "SiteConfigRevision_configId_createdAt_idx" ON "SiteConfigRevision"("configId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "QrCode_code_key" ON "QrCode"("code");

-- CreateIndex
CREATE INDEX "QrCode_active_idx" ON "QrCode"("active");

-- CreateIndex
CREATE INDEX "QrScan_qrCodeId_at_idx" ON "QrScan"("qrCodeId", "at");

-- CreateIndex
CREATE UNIQUE INDEX "Redirect_fromPath_key" ON "Redirect"("fromPath");

-- CreateIndex
CREATE INDEX "Redirect_active_idx" ON "Redirect"("active");

-- CreateIndex
CREATE UNIQUE INDEX "AbTest_slug_key" ON "AbTest"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "AbVariant_testId_key_key" ON "AbVariant"("testId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "ReplaySession_sessionKey_key" ON "ReplaySession"("sessionKey");

-- CreateIndex
CREATE INDEX "ReplaySession_startedAt_idx" ON "ReplaySession"("startedAt");

-- CreateIndex
CREATE INDEX "ReplayChunk_sessionId_seq_idx" ON "ReplayChunk"("sessionId", "seq");

-- CreateIndex
CREATE INDEX "HeatmapEvent_path_type_idx" ON "HeatmapEvent"("path", "type");

-- CreateIndex
CREATE INDEX "HeatmapEvent_at_idx" ON "HeatmapEvent"("at");

-- CreateIndex
CREATE UNIQUE INDEX "ConsentTemplate_key_key" ON "ConsentTemplate"("key");

-- CreateIndex
CREATE UNIQUE INDEX "ConsentRequest_token_key" ON "ConsentRequest"("token");

-- CreateIndex
CREATE INDEX "ConsentRequest_bookingId_idx" ON "ConsentRequest"("bookingId");

-- CreateIndex
CREATE INDEX "ConsentRequest_clientId_status_idx" ON "ConsentRequest"("clientId", "status");

-- CreateIndex
CREATE INDEX "SignedConsent_bookingId_idx" ON "SignedConsent"("bookingId");

-- CreateIndex
CREATE INDEX "SignedConsent_clientId_idx" ON "SignedConsent"("clientId");

-- CreateIndex
CREATE INDEX "BeforePhoto_bookingId_idx" ON "BeforePhoto"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");

-- CreateIndex
CREATE INDEX "Product_status_idx" ON "Product"("status");

-- CreateIndex
CREATE INDEX "Product_category_idx" ON "Product"("category");

-- CreateIndex
CREATE UNIQUE INDEX "Order_number_key" ON "Order"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Order_stripePaymentIntentId_key" ON "Order"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");

-- CreateIndex
CREATE INDEX "DayClose_businessDate_idx" ON "DayClose"("businessDate");

-- CreateIndex
CREATE INDEX "DayClose_locationId_businessDate_idx" ON "DayClose"("locationId", "businessDate");

-- CreateIndex
CREATE INDEX "DayClose_status_idx" ON "DayClose"("status");

-- CreateIndex
CREATE INDEX "BuildItem_status_idx" ON "BuildItem"("status");

-- CreateIndex
CREATE INDEX "BuildItem_assignee_status_idx" ON "BuildItem"("assignee", "status");

-- CreateIndex
CREATE INDEX "BuildItem_urgency_idx" ON "BuildItem"("urgency");

-- CreateIndex
CREATE INDEX "BuildItem_createdAt_idx" ON "BuildItem"("createdAt");

-- CreateIndex
CREATE INDEX "BuildItem_projectId_idx" ON "BuildItem"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "BuildProject_slug_key" ON "BuildProject"("slug");

-- CreateIndex
CREATE INDEX "BuildDependency_dependsOnId_idx" ON "BuildDependency"("dependsOnId");

-- CreateIndex
CREATE UNIQUE INDEX "BuildDependency_itemId_dependsOnId_key" ON "BuildDependency"("itemId", "dependsOnId");

-- CreateIndex
CREATE INDEX "BuildSubtask_itemId_order_idx" ON "BuildSubtask"("itemId", "order");

-- CreateIndex
CREATE INDEX "BuildEvent_itemId_createdAt_idx" ON "BuildEvent"("itemId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "NpsResponse_token_key" ON "NpsResponse"("token");

-- CreateIndex
CREATE INDEX "NpsResponse_clientId_idx" ON "NpsResponse"("clientId");

-- CreateIndex
CREATE INDEX "NpsResponse_respondedAt_idx" ON "NpsResponse"("respondedAt");

-- CreateIndex
CREATE INDEX "NpsResponse_sentAt_idx" ON "NpsResponse"("sentAt");

-- CreateIndex
CREATE INDEX "MaintenanceWindow_status_startAt_idx" ON "MaintenanceWindow"("status", "startAt");

-- CreateIndex
CREATE INDEX "StaffNotification_userId_readAt_idx" ON "StaffNotification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "StaffNotification_userId_createdAt_idx" ON "StaffNotification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "StaffNotification_userId_groupKey_idx" ON "StaffNotification"("userId", "groupKey");

-- CreateIndex
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "KioskSession_token_key" ON "KioskSession"("token");

-- CreateIndex
CREATE INDEX "KioskSession_token_idx" ON "KioskSession"("token");

-- CreateIndex
CREATE INDEX "KioskSession_status_createdAt_idx" ON "KioskSession"("status", "createdAt");

-- CreateIndex
CREATE INDEX "KioskSession_locationId_idx" ON "KioskSession"("locationId");

-- CreateIndex
CREATE UNIQUE INDEX "KioskResult_sessionId_key" ON "KioskResult"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "KioskResult_shareSlug_key" ON "KioskResult"("shareSlug");

-- CreateIndex
CREATE INDEX "KioskResult_shareSlug_idx" ON "KioskResult"("shareSlug");

-- CreateIndex
CREATE INDEX "KioskEvent_event_createdAt_idx" ON "KioskEvent"("event", "createdAt");

-- CreateIndex
CREATE INDEX "KioskEvent_sessionId_idx" ON "KioskEvent"("sessionId");

-- CreateIndex
CREATE INDEX "Device_kind_active_idx" ON "Device"("kind", "active");

-- CreateIndex
CREATE INDEX "QuestionnaireVersion_key_version_idx" ON "QuestionnaireVersion"("key", "version");

-- CreateIndex
CREATE INDEX "RoomClosure_roomId_startAt_endAt_idx" ON "RoomClosure"("roomId", "startAt", "endAt");

-- CreateIndex
CREATE INDEX "WaitlistEntry_treatmentSlug_status_idx" ON "WaitlistEntry"("treatmentSlug", "status");

-- CreateIndex
CREATE INDEX "WaitlistEntry_clientId_idx" ON "WaitlistEntry"("clientId");

-- CreateIndex
CREATE INDEX "_BookingToResource_B_index" ON "_BookingToResource"("B");

-- CreateIndex
CREATE INDEX "_StaffLocations_B_index" ON "_StaffLocations"("B");

-- CreateIndex
CREATE INDEX "_RoomEquipment_B_index" ON "_RoomEquipment"("B");

-- AddForeignKey
ALTER TABLE "CallRecord" ADD CONSTRAINT "CallRecord_matchedClientId_fkey" FOREIGN KEY ("matchedClientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallRecord" ADD CONSTRAINT "CallRecord_matchedSupplierId_fkey" FOREIGN KEY ("matchedSupplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consultation" ADD CONSTRAINT "Consultation_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultationNote" ADD CONSTRAINT "ConsultationNote_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "Consultation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interaction" ADD CONSTRAINT "Interaction_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_practitionerId_fkey" FOREIGN KEY ("practitionerId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_marketingCampaignId_fkey" FOREIGN KEY ("marketingCampaignId") REFERENCES "MarketingCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentSession" ADD CONSTRAINT "AppointmentSession_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceVariant" ADD CONSTRAINT "ServiceVariant_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOffer" ADD CONSTRAINT "ServiceOffer_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOffer" ADD CONSTRAINT "ServiceOffer_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ServiceVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingItem" ADD CONSTRAINT "BookingItem_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingItem" ADD CONSTRAINT "BookingItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ServiceVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailEvent" ADD CONSTRAINT "EmailEvent_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractorTask" ADD CONSTRAINT "ContractorTask_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractorTask" ADD CONSTRAINT "ContractorTask_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractorVisit" ADD CONSTRAINT "ContractorVisit_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebAuthnCredential" ADD CONSTRAINT "WebAuthnCredential_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffPoints" ADD CONSTRAINT "StaffPoints_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardRedemption" ADD CONSTRAINT "RewardRedemption_rewardId_fkey" FOREIGN KEY ("rewardId") REFERENCES "Reward"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardRedemption" ADD CONSTRAINT "RewardRedemption_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffSchedule" ADD CONSTRAINT "StaffSchedule_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffSchedule" ADD CONSTRAINT "StaffSchedule_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicClosure" ADD CONSTRAINT "ClinicClosure_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomPrep" ADD CONSTRAINT "RoomPrep_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffTimeOff" ADD CONSTRAINT "StaffTimeOff_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "StockItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthAssessment" ADD CONSTRAINT "HealthAssessment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscountClaim" ADD CONSTRAINT "DiscountClaim_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientPoints" ADD CONSTRAINT "ClientPoints_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referredId_fkey" FOREIGN KEY ("referredId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_clinicianId_fkey" FOREIGN KEY ("clinicianId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentPasskey" ADD CONSTRAINT "StudentPasskey_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "AcademyStudent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseModule" ADD CONSTRAINT "CourseModule_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "CourseModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkSubmission" ADD CONSTRAINT "HomeworkSubmission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "AcademyStudent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkSubmission" ADD CONSTRAINT "HomeworkSubmission_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "CourseModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizQuestion" ADD CONSTRAINT "QuizQuestion_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonProgress" ADD CONSTRAINT "LessonProgress_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "AcademyStudent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonProgress" ADD CONSTRAINT "LessonProgress_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "AcademyStudent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamQuestion" ADD CONSTRAINT "ExamQuestion_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PastPaper" ADD CONSTRAINT "PastPaper_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeAttempt" ADD CONSTRAINT "PracticeAttempt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "AcademyStudent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointEvent" ADD CONSTRAINT "PointEvent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "AcademyStudent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentBadge" ADD CONSTRAINT "StudentBadge_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "AcademyStudent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyActivity" ADD CONSTRAINT "DailyActivity_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "AcademyStudent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveClass" ADD CONSTRAINT "LiveClass_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cohort" ADD CONSTRAINT "Cohort_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrolment" ADD CONSTRAINT "Enrolment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrolment" ADD CONSTRAINT "Enrolment_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrolment" ADD CONSTRAINT "Enrolment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "AcademyStudent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundingApplication" ADD CONSTRAINT "FundingApplication_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAnalysis" ADD CONSTRAINT "AiAnalysis_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAnalysisImage" ADD CONSTRAINT "AiAnalysisImage_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "AiAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_vacancyId_fkey" FOREIGN KEY ("vacancyId") REFERENCES "Vacancy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromoRedemption" ADD CONSTRAINT "PromoRedemption_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "PromoCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ChatConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PageRevision" ADD CONSTRAINT "PageRevision_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteConfigRevision" ADD CONSTRAINT "SiteConfigRevision_configId_fkey" FOREIGN KEY ("configId") REFERENCES "SiteConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QrScan" ADD CONSTRAINT "QrScan_qrCodeId_fkey" FOREIGN KEY ("qrCodeId") REFERENCES "QrCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbVariant" ADD CONSTRAINT "AbVariant_testId_fkey" FOREIGN KEY ("testId") REFERENCES "AbTest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplayChunk" ADD CONSTRAINT "ReplayChunk_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ReplaySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DayClose" ADD CONSTRAINT "DayClose_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildItem" ADD CONSTRAINT "BuildItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "BuildProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildDependency" ADD CONSTRAINT "BuildDependency_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "BuildItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildDependency" ADD CONSTRAINT "BuildDependency_dependsOnId_fkey" FOREIGN KEY ("dependsOnId") REFERENCES "BuildItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildSubtask" ADD CONSTRAINT "BuildSubtask_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "BuildItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildEvent" ADD CONSTRAINT "BuildEvent_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "BuildItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NpsResponse" ADD CONSTRAINT "NpsResponse_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffNotification" ADD CONSTRAINT "StaffNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KioskResult" ADD CONSTRAINT "KioskResult_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "KioskSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomClosure" ADD CONSTRAINT "RoomClosure_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BookingToResource" ADD CONSTRAINT "_BookingToResource_A_fkey" FOREIGN KEY ("A") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BookingToResource" ADD CONSTRAINT "_BookingToResource_B_fkey" FOREIGN KEY ("B") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_StaffLocations" ADD CONSTRAINT "_StaffLocations_A_fkey" FOREIGN KEY ("A") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_StaffLocations" ADD CONSTRAINT "_StaffLocations_B_fkey" FOREIGN KEY ("B") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RoomEquipment" ADD CONSTRAINT "_RoomEquipment_A_fkey" FOREIGN KEY ("A") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RoomEquipment" ADD CONSTRAINT "_RoomEquipment_B_fkey" FOREIGN KEY ("B") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

