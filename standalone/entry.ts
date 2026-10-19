// Browser bundle for the standalone Aldune app. Exposes the tested engine, ingestion, models, and templates as window.PC.
import { Packer } from 'docx';
import { runEngine } from '../src/lib/engine/engine';
import { runAudit, assessDataQuality } from '../src/lib/engine/audit';
import { analyzeShift, allocateOvertime, DEFAULT_ASSUMPTIONS } from '../src/lib/engine/engine';
import { CATEGORY_LABELS, approx } from '../src/lib/engine/exposure';
import { analyzePatterns } from '../src/lib/engine/detective';
import { runScenario, DEFAULT_SCENARIO, PERSPECTIVES, valueSettlement, DEFAULT_SETTLEMENT, snapshot, compareSnapshots, buildDiligence } from '../src/lib/engine/modeling';
import { RULES } from '../src/lib/engine/rules/registry';
import { parseTime, fmtTime, stateMinWageOn, exemptSalaryFloor } from '../src/lib/engine/time';
import { suggestMapping, FIELDS, missingRequired } from '../src/lib/ingest/mapping';
import { parseFile, normalize } from '../src/lib/ingest/normalize';
import { generateDemo, DEMO_COMPANY } from '../src/lib/demo/generate';
import * as T from '../src/lib/documents/templates';
import { toHtml } from '../src/lib/documents/render';
import { assessQuality } from '../src/lib/engine/quality';
import { ledgerFor, employeeLedger } from '../src/lib/engine/ledger';
import { NAMED_SCENARIOS, compareScenarios, pagaRegimeFor, PAGA_REGIMES } from '../src/lib/engine/modeling';
import { TOOLS, executeTool, finalizeCitations, runAssistantTurn } from '../src/lib/assistant/core';
import { answerOffline, httpModel } from '../src/lib/assistant/offline';
import { LAW, searchLaw, lawById, LAW_CATEGORIES } from '../src/lib/law/kb';
import { backPay, playbooks, cureItems } from '../src/lib/remedies';
import { FAQ, ACTIONS, actionsFor, matchFaq } from '../src/lib/law/faq';
import { analyzeNotice, allocateSettlement } from '../src/lib/remedies/notice';
import { parseRecordsPacket, looksLikeRecordsPacket } from '../src/lib/ingest/packet';
import { classifyDataDocument, parsePayStub, parseTimesheet, parseW2, parseW2s, parseW2Table, parseRoster, cleanName, buildTables, w2Reconcile, workerKey, maskSensitive } from '../src/lib/ingest/documents';
import { confidenceFor } from '../src/lib/engine/ledger';
import { minWageFor, LOCAL_MIN_WAGE, INDUSTRY_MIN_WAGE, COMPUTER_PRO, agOvertimeThresholds } from '../src/lib/engine/time';
import { makeLocalAccess } from '../src/lib/assistant/local';
import { CHECKS, classifyDocument, quickCheckDocument, DOC_LABELS } from '../src/lib/documents/review';
import { PLANS, ADDONS, SERVICE_TIERS } from '../src/config/app';
import * as XLSX from 'xlsx';
import { extractDocument, pdfPageImages } from '../src/lib/documents/browserExtract';
import { INDUSTRIES, industryProfile, INDUSTRY_CHANGES, STANDARD_RULES } from '../src/lib/engine/industries';
import { caseTimeline, extractCaseFacts, valueClaims, negotiation, allocation, reviewIndividualSettlement, DEFAULT_INPUTS as LIT_DEFAULTS } from '../src/lib/litigation/model';
import * as LIT from '../src/lib/litigation/docs';
import { repairOcrText, markLowConfidence } from '../src/lib/ingest/ocrFix';
import { analyzeCase, caseAnalysisMemo, classifyCaseDocument, CASE_DOC_LABEL, CLAIM_LAW, claimOf } from '../src/lib/litigation/caseAnalysis';
import { reasonableSteps, pickUpSticks } from '../src/lib/remedies/steps';
import { analyzeArbitration } from '../src/lib/documents/arbitration';
import { classifyWorker, jointEmployer, EXEMPTIONS, BORELLO } from '../src/lib/classification';
import { deadlinesFor, DEADLINE_EVENTS } from '../src/lib/deadlines';
import * as CUSTOM_TPL from '../src/lib/documents/customTemplate';
import { applyExculpatory, documentKinds } from '../src/lib/documents/exculpatory';
import JSZipLib from 'jszip';
import { checkIntegrity } from '../src/lib/ingest/integrity';
import { scorecard } from '../src/lib/engine/scorecard';
import { portfolio } from '../src/lib/engine/portfolio';
import { payEquity } from '../src/lib/engine/payequity';
import { fingerprints } from '../src/lib/engine/fingerprints';
import { capabilities } from '../src/lib/engine/capabilities';
import { proactiveAlerts } from '../src/lib/engine/proactive';
import { matterPlan, employeeRecords, MATTER_LABEL } from '../src/lib/agency';
import { prePayrollCheck, scheduleGuardrails } from '../src/lib/prevention';
import { tacticViability, standingCheck, playbook, TACTIC_LABEL } from '../src/lib/litigation/tactics';
import { applyPack, validatePack, appliedPacks } from '../src/lib/law/updates';
import { privilegeLabel, privilegeReadiness, NON_PRIVILEGED_LABEL } from '../src/lib/privilege';
import { maDiligence } from '../src/lib/ma/successor';
import * as DOCS3 from '../src/lib/documents/templates3';
import { validateRule, runRule, parse as parseRule } from '../src/lib/rules/dsl';
import * as DOCS2 from '../src/lib/documents/templates2';
import { CA_POS_REQUIREMENTS, POS_SYSTEMS, posRecommendations, posConfigMemo } from '../src/lib/pos';
import { coverage } from '../src/lib/engine/coverage';
import { reviewHandbook, redlinePlan, PROBLEMS, REQUIRED } from '../src/lib/documents/handbook';
import { redlineDocx, cleanHandbookDocx } from '../src/lib/documents/handbookDocx';
import { reviewParagraphs, detectKind as reviewKind } from '../src/lib/documents/redline/rules';
import { reviseDocument } from '../src/lib/documents/redline/docx';
import { reviewMemoDocx } from '../src/lib/documents/redline/memo';
import * as R from '../src/lib/documents/render';

// Browser-safe DOCX: same layout code, Blob output.
async function toDocxBlob(models: Parameters<typeof R.toHtml>[0]): Promise<Blob> {
  const orig = Packer.toBuffer; (Packer as unknown as { toBuffer: typeof Packer.toBlob }).toBuffer = Packer.toBlob as never;
  try { return (await R.toDocx(models)) as unknown as Blob; } finally { (Packer as unknown as { toBuffer: typeof orig }).toBuffer = orig; }
}

(window as unknown as { PC: unknown }).PC = {
  reviewParagraphs, reviewKind, reviseDocument, reviewMemoDocx,
  runAudit, assessDataQuality, analyzeShift, allocateOvertime, DEFAULT_ASSUMPTIONS, CATEGORY_LABELS, approx,
  analyzePatterns, runScenario, DEFAULT_SCENARIO, PERSPECTIVES, valueSettlement, DEFAULT_SETTLEMENT, snapshot, compareSnapshots, buildDiligence,
  RULES, fmtTime, stateMinWageOn, exemptSalaryFloor, suggestMapping, FIELDS, missingRequired, parseFile, normalize, generateDemo, DEMO_COMPANY,
  repairOcrText, markLowConfidence,
  analyzeCase, caseAnalysisMemo, classifyCaseDocument, CASE_DOC_LABEL, CLAIM_LAW, claimOf,
  templates: T, toHtml, toDocxBlob, CUSTOM_TPL, JSZip: JSZipLib, applyExculpatory, documentKinds,
  assessQuality, ledgerFor, employeeLedger, NAMED_SCENARIOS, compareScenarios, pagaRegimeFor, PAGA_REGIMES,
  TOOLS, executeTool, finalizeCitations, runAssistantTurn, answerOffline, httpModel, LAW, searchLaw, lawById, LAW_CATEGORIES, backPay, playbooks, cureItems, FAQ, ACTIONS, actionsFor, matchFaq, analyzeNotice, allocateSettlement, parseRecordsPacket, looksLikeRecordsPacket, classifyDataDocument, parsePayStub, parseTimesheet, parseW2, parseW2s, parseW2Table, parseRoster, cleanName, pdfPageImages, buildTables, w2Reconcile, workerKey, maskSensitive, confidenceFor, minWageFor, LOCAL_MIN_WAGE, INDUSTRY_MIN_WAGE, COMPUTER_PRO, agOvertimeThresholds, makeLocalAccess, CHECKS, classifyDocument, quickCheckDocument, DOC_LABELS, PLANS, XLSX, runEngine, parseTime, caseTimeline, reasonableSteps, pickUpSticks, analyzeArbitration, classifyWorker, jointEmployer, EXEMPTIONS, BORELLO, deadlinesFor, DEADLINE_EVENTS, checkIntegrity, scorecard, portfolio, payEquity, fingerprints, capabilities, proactiveAlerts, matterPlan, employeeRecords, MATTER_LABEL, prePayrollCheck, scheduleGuardrails, tacticViability, standingCheck, playbook, TACTIC_LABEL, applyPack, validatePack, appliedPacks, privilegeLabel, privilegeReadiness, NON_PRIVILEGED_LABEL, maDiligence, docs3: DOCS3, ADDONS, SERVICE_TIERS, validateRule, runRule, parseRule, docs2: DOCS2, extractCaseFacts, valueClaims, negotiation, allocation, reviewIndividualSettlement, LIT_DEFAULTS, lit: LIT, CA_POS_REQUIREMENTS, POS_SYSTEMS, posRecommendations, posConfigMemo, INDUSTRIES, industryProfile, INDUSTRY_CHANGES, STANDARD_RULES, coverage, reviewHandbook, redlinePlan, HANDBOOK_PROBLEMS: PROBLEMS, HANDBOOK_REQUIRED: REQUIRED, redlineDocx, cleanHandbookDocx, extractDocument
};
