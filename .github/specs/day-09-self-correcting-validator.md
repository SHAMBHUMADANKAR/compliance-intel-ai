# Day 9 — Self-Correcting Loops & the Validator Node

**Page(s) touched:** none directly — still backend/AI only. This is the last "invisible" day before Day 10 finally puts a UI in front of everything you've built since Day 6.
**You'll be able to say afterward:** "I understand the specific, concrete failure mode this validator prevents, and why schema-valid output isn't the same thing as trustworthy output."

---

## Learning goal
Local 8B-14B models are genuinely good, but they are not infallible readers of dense regulatory text, and — more importantly for a compliance product — they can produce answers that *look* confident and well-formatted while being ungrounded in the actual retrieved evidence. Today's job is to catch that before it reaches a user who might file it as an official compliance finding.

## The specific failure mode this defends against
A model can return perfectly valid JSON matching your expected schema — every field present, every type correct — while still **fabricating** the citation excerpt: quoting text that sounds plausible but doesn't actually appear anywhere in the chunks it was given. Schema validation alone (does this parse as a `ComplianceFinding`?) would let this straight through. You need a second, independent check: is the cited text *actually present* in the evidence the model was handed?

## Stack
- LangGraph conditional edges (routing logic based on state)
- Pydantic (schema definition + validation)
- The same Ollama-backed reasoner from Day 8

## The schema
```python
class ComplianceFinding(BaseModel):
    control_ref: str
    verdict: Literal["compliant", "non_compliant", "needs_review"]
    citation_document_id: str
    citation_excerpt: str          # must be a verbatim substring of something in state["evidence"]
    reasoning: str
```

## The validator node
```python
def validate(state: ComplianceAgentState) -> ComplianceAgentState:
    errors = []
    try:
        finding = ComplianceFinding.model_validate(state["draft_answer_raw"])
    except ValidationError as e:
        errors.append(f"schema_error: {e}")
        return {**state, "validation_errors": errors}

    evidence_text = "".join(c.text for c in state["evidence"])
    if finding.citation_excerpt not in evidence_text:
        errors.append("citation_not_grounded")

    return {**state, "validation_errors": errors, "finding": finding if not errors else None}
```
Two independent checks, in order: does this parse as valid structured output at all (`schema_error`), and separately, is the citation actually grounded in real evidence (`citation_not_grounded`). Notice these catch genuinely different failure modes — a model can pass the first and fail the second, which is exactly the fabrication scenario described above.

## Routing on failure — the self-correcting loop
A conditional edge inspects `validation_errors` after the validator runs:
- **Empty** → proceed to `formatter`, the answer is trustworthy enough to show the user.
- **Non-empty, retries remaining** (cap at ~2) → route back to `retriever` (if the failure suggests the evidence set itself was thin — e.g., no chunk was ever relevant enough to legitimately answer this) or back to `reasoner` (if the failure looks like a formatting slip rather than an evidence problem), with the specific error appended to the next prompt's context so the model can see exactly what it got wrong last time, not just "try again."
- **Retries exhausted** → route to a `needs_review` terminal state. Critically, this still returns *something* to the user — just honestly flagged as unconfirmed rather than presented with the same visual confidence as a validated finding. Compare this to the Audit Report mockup's amber "needs review" pill versus the green "compliant" pill — that UI distinction exists specifically because of this backend routing decision.

## `temperature=0.0` — a project-wide rule, explained
Every LLM call in the reasoner and validator paths uses `temperature=0.0` (deterministic/greedy decoding, no random sampling). This isn't a minor tuning knob — it's a correctness requirement specific to this product's domain: a compliance finding needs to be **reproducible**. If a compliance officer re-runs the same audit question against the same corpus next week and gets a different verdict purely because of sampling randomness, that undermines the entire premise of an auditable system. This rule applies everywhere an LLM call touches an actual compliance verdict, not just inside today's validator.

## Deliverables checklist
- [ ] `ComplianceFinding` schema enforced via Pydantic
- [ ] Grounding check (`citation_excerpt` must appear verbatim in retrieved evidence) implemented and tested with a deliberately fabricated citation to confirm it actually catches the failure
- [ ] Conditional edge with a bounded retry count — verify by forcing a failure and confirming the graph terminates instead of looping forever
- [ ] `needs_review` terminal path distinguishable from a confident finding, both in the state object and (later, Day 11) in the UI
- [ ] Every LLM call in this pipeline confirmed to pass `temperature=0.0` — grep the codebase for every Ollama call site and check
