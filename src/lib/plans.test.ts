import { describe, it, expect } from "vitest";
import { PLANS, creditCost, TRIAL_SECONDS, VIDEO_RETENTION_MS, PAYMENT_WINDOW_MS } from "./plans";
describe("Regras comerciais MotionMRO", () => {
  it.each([["starter",97,100,90],["creator",197,250,600],["pro",397,600,600],["agency",797,1400,600]])("plano %s", (id,price,credits,maxSeconds) => {
    expect(PLANS.find((p) => p.id === id)).toMatchObject({ price, credits, maxSeconds });
  });
  it.each([[30,10],[60,15],[90,20],[180,30],[300,50],[600,100]])("%i segundos consomem %i créditos", (seconds,credits) => expect(creditCost(seconds)).toBe(credits));
  it("não permite vídeos acima de dez minutos", () => expect(() => creditCost(601)).toThrow());
  it("limita o teste ao total de 90 segundos", () => expect(TRIAL_SECONDS).toBe(90));
  it("retém vídeos por exatamente dois dias", () => expect(VIDEO_RETENTION_MS).toBe(172800000));
  it("acompanha pagamentos por dez minutos", () => expect(PAYMENT_WINDOW_MS).toBe(600000));
});