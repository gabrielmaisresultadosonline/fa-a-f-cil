import { describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { precoIA } from "./costs";
import { PRECOS_PADRAO } from "./settings";

describe("custo real OpenAI", () => {
  it("usa US$1 entrada e US$5 saída por 1M no gpt-6.1-terra", () => {
    // consumo mostrado no painel da OpenAI: 43.414 entrada, 77.736 saída
    expect(precoIA("gpt-6.1-terra", 43_414, 77_736, 0, PRECOS_PADRAO)).toBeCloseTo(0.4321, 4);
  });
  it("cobra tokens de entrada em cache a US$0,05 por 1M", () => {
    expect(precoIA("gpt-6.1-terra", 1_000_000, 0, 1_000_000, PRECOS_PADRAO)).toBeCloseTo(0.05, 6);
  });
});
