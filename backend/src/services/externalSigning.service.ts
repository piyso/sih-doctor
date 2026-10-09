/**
 * Integration seams that need an external agreement or credentials. Both are off until configured
 * and say so; nothing pretends to be connected.
 *
 * 1. Legal e-signature. The Ed25519 signature on every prescription is a tamper-evident seal
 *    (integrity + which staff key signed). A *legally recognised* electronic signature under the
 *    IT Act 2000 (Second Schedule) is an Aadhaar eSign or a DSC from a licensed Certifying
 *    Authority, obtained through an eSign Service Provider (ESP) under an ASP agreement.
 *    Configure ESIGN_ESP_URL + ESIGN_ASP_ID to enable the hand-off; until then prescriptions
 *    carry the seal and a wet signature on the printout.
 *
 * 2. Bhashini (MeitY) machine translation for free-text advice, used only when the on-premise
 *    translator is unavailable and BHASHINI_USER_ID + BHASHINI_API_KEY + BHASHINI_PIPELINE_ID are
 *    set. Only the advice sentence is sent (no patient identifiers). The call follows the public
 *    ULCA pipeline API; it has not been exercised against the live service from this codebase.
 */

export const ESignService = {
  status() {
    const configured = !!(process.env.ESIGN_ESP_URL && process.env.ESIGN_ASP_ID);
    return {
      configured,
      method: configured ? (process.env.ESIGN_METHOD || 'aadhaar_esign') : 'none',
      seal: 'Ed25519 tamper-evident seal on every record',
      note: configured
        ? 'eSign hand-off enabled: the prescriber authenticates with the ESP to apply a legal signature.'
        : 'Legal e-signature not configured: records carry the Ed25519 seal; the printout is signed by hand. Configure an eSign Service Provider (ASP agreement) for Aadhaar eSign / DSC.'
    };
  }
};

const BHASHINI_AUTH = 'https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline';

export const BhashiniClient = {
  configured() {
    return !!(process.env.BHASHINI_USER_ID && process.env.BHASHINI_API_KEY && process.env.BHASHINI_PIPELINE_ID);
  },

  async translate(texts: string[], source: string, target: string): Promise<{ translations: string[]; model: string }> {
    if (!this.configured()) throw new Error('Bhashini is not configured');
    const headers = { 'Content-Type': 'application/json', userID: process.env.BHASHINI_USER_ID!, ulcaApiKey: process.env.BHASHINI_API_KEY! };
    const cfg = await fetch(BHASHINI_AUTH, {
      method: 'POST', headers,
      body: JSON.stringify({ pipelineTasks: [{ taskType: 'translation', config: { language: { sourceLanguage: source, targetLanguage: target } } }], pipelineRequestConfig: { pipelineId: process.env.BHASHINI_PIPELINE_ID } }),
      signal: AbortSignal.timeout(8000)
    });
    if (!cfg.ok) throw new Error(`Bhashini config ${cfg.status}`);
    const c: any = await cfg.json();
    const endpoint = c?.pipelineInferenceAPIEndPoint;
    const serviceId = c?.pipelineResponseConfig?.[0]?.config?.[0]?.serviceId;
    if (!endpoint?.callbackUrl || !serviceId) throw new Error('Bhashini returned no translation service for this language pair');
    const out: string[] = [];
    for (const text of texts) {
      const r = await fetch(endpoint.callbackUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', [endpoint.inferenceApiKey?.name || 'Authorization']: endpoint.inferenceApiKey?.value || '' },
        body: JSON.stringify({ pipelineTasks: [{ taskType: 'translation', config: { language: { sourceLanguage: source, targetLanguage: target }, serviceId } }], inputData: { input: [{ source: text }] } }),
        signal: AbortSignal.timeout(8000)
      });
      if (!r.ok) throw new Error(`Bhashini inference ${r.status}`);
      const j: any = await r.json();
      out.push(String(j?.pipelineResponse?.[0]?.output?.[0]?.target || ''));
    }
    return { translations: out, model: `bhashini:${serviceId}` };
  }
};
