import { criarProjeto } from "../../../acoes";
import { FormAcao } from "@/componentes/FormAcao";
import { CamposProjeto } from "@/componentes/CamposProjeto";
import { Campo, Voltar } from "@/componentes/ui";
import { listar } from "@/lib/banco";
import { contexto } from "@/lib/sessao";
import type { Cliente } from "@/lib/tipos";

export default async function NovoProjeto() {
  const { empresa } = await contexto();
  const clientes = await listar<Cliente>("clientes", empresa.id);
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Voltar href="/" texto="Painel" />
      <h1 className="titulo text-2xl">Novo projeto</h1>
      <p className="text-sm text-cinza">Empresa: <strong className="text-azul">{empresa.nome}</strong>. Só o nome da obra e o cliente são obrigatórios; o que você deixar vazio fica marcado como <span className="adefinir">a definir</span> e aparece em &quot;Falta preencher&quot;.</p>
      <FormAcao acao={criarProjeto} botao="Criar projeto" className="space-y-4">
        <div className="cartao">
          <h2 className="titulo mb-3 text-sm">1. Cliente</h2>
          {clientes.length > 0 && (
            <label className="mb-3 block"><span className="rotulo">Cliente já cadastrado</span>
              <select name="clienteId" className="campo" defaultValue=""><option value="">Novo cliente (preencha abaixo)</option>{clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select>
            </label>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo rotulo="Nome do novo cliente" nome="clienteNome" obrigatorio={clientes.length === 0} />
            <Campo rotulo="CPF ou CNPJ" nome="clienteCpf" />
            <Campo rotulo="Telefone" nome="clienteTelefone" />
            <Campo rotulo="E-mail" nome="clienteEmail" tipo="email" />
          </div>
        </div>
        <div className="cartao">
          <h2 className="titulo mb-3 text-sm">2. Obra</h2>
          <CamposProjeto />
        </div>
      </FormAcao>
    </div>
  );
}
