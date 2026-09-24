import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import * as engine from "./engine";
import { forCustomer } from "./control-plane";

export const getWorkspaceFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => forCustomer(context.userId).getWorkspace());

export const provisionDemoFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => engine.provisionDemo(context.userId));

export const startOtpFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { destination: string; method: "sms" | "voice" | "email" }) => input)
  .handler(async ({ context, data }) => engine.startOtp(context.userId, data.destination, data.method));

export const verifyOtpFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { code: string; method: "sms" | "voice" | "email" }) => input)
  .handler(async ({ context, data }) => engine.verifyOtp(context.userId, data.code, data.method));

export const savePersonalFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: Parameters<typeof engine.savePersonal>[1]) => input)
  .handler(async ({ context, data }) => engine.savePersonal(context.userId, data));

export const kycStartFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => engine.kycStart(context.userId));

export const kycSubmitDocumentFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { documentType: string }) => input)
  .handler(async ({ context, data }) => engine.kycSubmitDocument(context.userId, data.documentType));

export const kycSubmitSelfieFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => engine.kycSubmitSelfie(context.userId));

export const saveSecurityFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: Parameters<typeof engine.saveSecurity>[1]) => input)
  .handler(async ({ context, data }) => engine.saveSecurity(context.userId, data));

export const submitCheckingFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => forCustomer(context.userId).submitChecking());

export const fundAccountFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: Parameters<typeof engine.fundAccount>[1]) => input)
  .handler(async ({ context, data }) => forCustomer(context.userId).fundAccount(data));

export const sendMoneyFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: Parameters<typeof engine.sendMoney>[1]) => input)
  .handler(async ({ context, data }) => forCustomer(context.userId).sendMoney(data));

export const issueDebitFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => engine.issueDebitCard(context.userId));

export const activateDebitFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { last4: string }) => input)
  .handler(async ({ context, data }) => engine.activateDebit(context.userId, data.last4));

export const setDebitPinFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { pin: string }) => input)
  .handler(async ({ context, data }) => engine.setDebitPin(context.userId, data.pin));

export const updateDebitFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: Parameters<typeof engine.updateDebit>[1]) => input)
  .handler(async ({ context, data }) => engine.updateDebit(context.userId, data));

export const applyCreditFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: Parameters<typeof engine.applyCredit>[1]) => input)
  .handler(async ({ context, data }) => engine.applyCredit(context.userId, data));

export const payCreditFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: Parameters<typeof engine.payCredit>[1]) => input)
  .handler(async ({ context, data }) => engine.payCredit(context.userId, data));

export const updateCreditFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: Parameters<typeof engine.updateCredit>[1]) => input)
  .handler(async ({ context, data }) => engine.updateCredit(context.userId, data));

export const listTransactionsFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { status?: string; query?: string } | undefined) => input ?? {})
  .handler(async ({ context, data }) => engine.listTransactions(context.userId, data));

export const getTransactionFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { id: string }) => input)
  .handler(async ({ context, data }) => engine.getTransaction(context.userId, data.id));

export const disputeTransactionFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; reason: string; details: string }) => input)
  .handler(async ({ context, data }) =>
    engine.disputeTransaction(context.userId, data.id, data.reason, data.details),
  );

export const listTransfersFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => engine.listTransfers(context.userId));

export const listStatementsFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => engine.listStatements(context.userId));

export const getStatementFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { id: string }) => input)
  .handler(async ({ context, data }) => engine.getStatement(context.userId, data.id));

export const listNotificationsFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => engine.listNotifications(context.userId));

export const markNotificationsReadFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => engine.markNotificationsRead(context.userId));

export const listDevicesFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => engine.listDevices(context.userId));

export const updateDeviceFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; trusted: boolean }) => input)
  .handler(async ({ context, data }) => engine.updateDevice(context.userId, data.id, data.trusted));

export const listFraudFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => engine.listFraud(context.userId));

export const ackFraudFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string }) => input)
  .handler(async ({ context, data }) => engine.ackFraud(context.userId, data.id));

export const createSupportCaseFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { subject: string; body: string }) => input)
  .handler(async ({ context, data }) => engine.createSupportCase(context.userId, data.subject, data.body));

export const listSupportCasesFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => engine.listSupportCases(context.userId));

export const listSupportMessagesFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { caseId: string }) => input)
  .handler(async ({ context, data }) => engine.listSupportMessages(context.userId, data.caseId));

export const addSupportMessageFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { caseId: string; body: string }) => input)
  .handler(async ({ context, data }) => engine.addSupportMessage(context.userId, data.caseId, data.body));

export const closeAccountFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { reason: string }) => input)
  .handler(async ({ context, data }) => engine.closeAccount(context.userId, data.reason));

export const getNotificationPrefsFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => engine.getNotificationPrefs(context.userId));

export const updateNotificationPrefsFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: Parameters<typeof engine.updateNotificationPrefs>[1]) => input)
  .handler(async ({ context, data }) => engine.updateNotificationPrefs(context.userId, data));

export const skipToDebitFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => engine.skipToDebit(context.userId));

export const continueOpeningFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => engine.continueOpening(context.userId));

export const continueKycFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => engine.continueKyc(context.userId));

export const rewindOnboardingFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { step: "username" | "phone" | "personal" | "kyc" | "security" }) => input)
  .handler(async ({ context, data }) => engine.rewindOnboarding(context.userId, data.step));

export const listSessionsFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => engine.listSessions(context.userId));

export const revokeSessionFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string }) => input)
  .handler(async ({ context, data }) => engine.revokeSession(context.userId, data.id));

export const claimAdminFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => engine.claimAdmin(context.userId));

export const publicFlagsFn = createServerFn({ method: "GET" }).handler(async () => engine.loadFeatureFlags());

export const publicProgramFn = createServerFn({ method: "GET" }).handler(async () => engine.publicProgramStatus());

export const resolveLoginFn = createServerFn({ method: "POST" })
  .validator((input: { identifier: string }) => input)
  .handler(async ({ data }) => engine.resolveLoginIdentifier(data.identifier));

export const checkLoginThrottleFn = createServerFn({ method: "POST" })
  .validator((input: { email: string }) => input)
  .handler(async ({ data }) => engine.checkLoginThrottle(data.email));

export const recordFailedLoginFn = createServerFn({ method: "POST" })
  .validator((input: { email: string }) => input)
  .handler(async ({ data }) => engine.recordFailedLogin(data.email));


export const claimUsernameFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { username: string }) => input)
  .handler(async ({ context, data }) => engine.claimUsername(context.userId, data.username));

export const checkUsernameFn = createServerFn({ method: "POST" })
  .validator((input: { username: string }) => input)
  .handler(async ({ data }) => engine.checkUsernameAvailability(data.username));

export const saveSignupBasicsFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { firstName: string; lastName: string; phone?: string }) => input)
  .handler(async ({ context, data }) => engine.saveSignupBasics(context.userId, data));

export const suggestAddressFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { query: string }) => input)
  .handler(async ({ data }) => engine.suggestAddresses(data.query));

export const lookupPostalFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { zip: string }) => input)
  .handler(async ({ data }) => engine.lookupPostalCode(data.zip));

export const verifyPasscodeFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { passcode: string }) => input)
  .handler(async ({ context, data }) => engine.verifyPasscode(context.userId, data.passcode));

export const setPrivacyModeFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { enabled: boolean }) => input)
  .handler(async ({ context, data }) => engine.setPrivacyMode(context.userId, data.enabled));

export const revokeOtherSessionsFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => engine.revokeOtherSessions(context.userId));

export const registerWebauthnFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { credentialId: string; deviceName?: string }) => input)
  .handler(async ({ context, data }) => engine.registerWebauthn(context.userId, data.credentialId, data.deviceName));

export const issueWebauthnChallengeFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { purpose: "unlock" | "reauth" }) => input)
  .handler(async ({ context, data }) => engine.issueWebauthnChallenge(context.userId, data.purpose));

export const assertWebauthnFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { challenge: string; credentialId: string }) => input)
  .handler(async ({ context, data }) => engine.assertWebauthn(context.userId, data));

export const createDemoTransferFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { amountCents: number; name: string; memo?: string; idempotencyKey: string }) => input)
  .handler(async ({ context, data }) => engine.createDemoTransfer(context.userId, data));

export const generateCurrentStatementFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => engine.generateCurrentStatement(context.userId));

export const generateStatementFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { periodStart: string; periodEnd: string; kind?: "monthly" | "yearly" | "custom" }) => input)
  .handler(async ({ context, data }) => engine.generateStatement(context.userId, data));

export const statementPdfFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { id: string }) => input)
  .handler(async ({ context, data }) => engine.statementPdf(context.userId, data.id));

export const listDocumentsFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => engine.listDocuments(context.userId));

export const receiptPdfFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { id: string }) => input)
  .handler(async ({ context, data }) => engine.receiptPdf(context.userId, data.id));

export const noticePdfFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { id: string }) => input)
  .handler(async ({ context, data }) => engine.noticePdf(context.userId, data.id));

export const downloadAllDocumentsFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { statements?: string[]; receipts?: string[]; notices?: string[] }) => input)
  .handler(async ({ context, data }) => engine.downloadAllDocuments(context.userId, data));

export const runCustomerKycAgentFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => engine.runCustomerKycAgent(context.userId));

