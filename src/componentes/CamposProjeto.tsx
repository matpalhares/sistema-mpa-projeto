import { Campo } from "./ui";
import { TIPOS_PROJETO } from "@/lib/etapas";
import type { Cliente, Projeto } from "@/lib/tipos";

// Campos do cadastro de projeto. A pergunta sobre execução nunca é assumida: fica "a definir" até responder.
export function CamposProjeto({ p, c }: { p?: Projeto; c?: Cliente | null }) {
  const exec = p ? (p.contratouExecucao === true ? "sim" : p.contratouExecucao === false ? "nao" : "") : "";
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo rotulo="Nome da obra ou projeto" nome="obra" valor={p?.obra} obrigatorio dica="Ex.: Residência Silva" />
        <label className="block"><span className="rotulo">Tipo</span>
          <select name="tipo" defaultValue={p?.tipo ?? ""} className="campo"><option value="">a definir</option>{TIPOS_PROJETO.map((t) => <option key={t}>{t}</option>)}</select>
        </label>
        <Campo rotulo="Endereço da obra" nome="endereco" valor={p?.endereco} />
        <Campo rotulo="Município" nome="municipio" valor={p?.municipio} dica="Ex.: Urupês-SP" />
        <Campo rotulo="Área (m²)" nome="areaM2" valor={p?.areaM2 != null ? String(p.areaM2).replace(".", ",") : ""} dica="Ex.: 180,50" />
        <Campo rotulo="Contrato (número ou referência)" nome="contrato" valor={p?.contrato} />
      </div>
      <fieldset>
        <legend className="rotulo">O cliente contratou a execução da obra?</legend>
        <p className="mb-2 text-xs text-cinza">Orçamento de obra e cronograma só aparecem no projeto se a resposta for Sim.</p>
        <div className="flex flex-wrap gap-2">
          {[["sim", "Sim, contratou a execução"], ["nao", "Não, só o projeto"], ["", "Ainda não sei (a definir)"]].map(([v, r]) => (
            <label key={v} className="opcao has-[:checked]:border-azul has-[:checked]:bg-azul has-[:checked]:text-white">
              <input type="radio" name="contratouExecucao" value={v} defaultChecked={exec === v} className="sr-only" />{r}
            </label>
          ))}
        </div>
      </fieldset>
      {p && (
        <div className="grid gap-3 border-t border-begelinha pt-4 sm:grid-cols-2">
          <Campo rotulo="Cliente" nome="clienteNome" valor={c?.nome} obrigatorio />
          <Campo rotulo="CPF ou CNPJ do cliente" nome="clienteCpf" valor={c?.cpfCnpj} />
          <Campo rotulo="Telefone do cliente" nome="clienteTelefone" valor={c?.telefone} />
          <Campo rotulo="E-mail do cliente" nome="clienteEmail" valor={c?.email} tipo="email" />
        </div>
      )}
    </div>
  );
}
