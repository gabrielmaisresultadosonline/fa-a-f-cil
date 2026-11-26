import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Project } from "./projects";

const mocks=vi.hoisted(()=>({callAgent:vi.fn(),saveProject:vi.fn(),validateSceneLayout:vi.fn()}));
vi.mock("./ai",()=>({callAgent:mocks.callAgent}));
vi.mock("./projects",()=>({saveProject:mocks.saveProject}));
vi.mock("./tts",()=>({gerarVoz:vi.fn()}));
vi.mock("./sceneLayout",()=>({prepareSceneHtml:(html:string)=>html,validateSceneLayout:mocks.validateSceneLayout}));
import { generateScene } from "./pipeline";

const makeProject=():Project=>({id:"motion",criadoEm:1,atualizadoEm:1,status:"produzindo",config:{nome:"Interno",ideia:"Oferta",duracao:4,largura:1080,altura:1920,estilo:"",paleta:"",publico:"",objetivo:"",idioma:"Português",velocidade:"Média",intensidade:"Alta"},agentes:{},log:[],cenas:[{id:"scene",titulo:"Oferta",duracao:4,textoPrincipal:"Oferta",descricaoVisual:"SVG",animacao:"Entrada",transicaoEntrada:"Fade",transicaoSaida:"Fade"}]});
beforeEach(()=>{vi.clearAllMocks();mocks.callAgent.mockResolvedValue({text:"<html><body>Oferta</body></html>"});mocks.validateSceneLayout.mockResolvedValue([]);});
describe("Validated motion generation",()=>{
  it("uses the same generator for one correction when layout is rejected",async()=>{
    mocks.validateSceneLayout.mockResolvedValueOnce(["Texto fora do quadro"]);
    const p=makeProject();await generateScene(p,0);
    expect(mocks.callAgent).toHaveBeenCalledTimes(2);
    expect(mocks.callAgent.mock.calls[1]?.[0]).toMatchObject({agente:"desenvolvedor",largura:1080,altura:1920});
    expect(mocks.callAgent.mock.calls[1]?.[0].contexto).toContain("Texto fora do quadro");
    expect(mocks.saveProject).toHaveBeenCalledTimes(1);
  });
  it("never saves a failed composition as a ready scene",async()=>{
    mocks.validateSceneLayout.mockResolvedValue(["Textos sobrepostos"]);
    const p=makeProject();await expect(generateScene(p,0)).rejects.toThrow("não aprovada");
    expect(mocks.saveProject).not.toHaveBeenCalled();
    expect(p.cenas[0]?.html).toBeUndefined();
  });
});