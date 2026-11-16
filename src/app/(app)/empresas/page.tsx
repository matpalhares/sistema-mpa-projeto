import { criarUsuario, salvarMarca } from "../../acoes";
import { FormAcao } from "@/componentes/FormAcao";
import { Campo } from "@/componentes/ui";
import { listar, usaSupabase } from "@/lib/banco";
import { iaDisponivel } from "@/lib/ia";
import { faltaNaMarca } from "@/lib/marca";
import { contexto } from "@/lib/sessao";
import type { Usuario } from "@/lib/tipos";

export default async function Empresas() {
  const { empresas } = await contexto();
  const usuarios = await listar<Usuario>("usuarios");
  return (
    <div className="space-y-6">
      <h1 className="titulo text-2xl">Empresas e marcas</h1>
      <p className="max-w-3xl text-sm text-cinza">Cada empresa tem o seu perfil de marca. Os documentos usam o perfil da empresa escolhida. Enquanto a marca estiver <span className="adefinir">a definir</span>, os documentos dessa empresa ficam bloqueados: o sistema não inventa logo, cor nem contato.</p>
      <div className="grid gap-4 lg:grid-cols-2">
        {empresas.map((e) => {
          const m = e.marca; const falta = faltaNaMarca(m);
          return (
            <details key={e.id} className="cartao" open={false}>
              <summary className="flex cursor-pointer flex-wrap items-center gap-3">
                <span className="flex gap-1">{[m.azul, m.dourado, m.offwhite, m.bege].map((c, i) => <span key={i} className="h-6 w-6 rounded-full border border-begelinha" style={{ background: c || "repeating-linear-gradient(45deg,#FFF2B3,#FFF2B3 4px,#fff 4px,#fff 8px)" }} />)}</span>
                <span className="grow font-semibold text-azul">{e.sigla} · {e.nome}</span>
                {m.definida ? <span className="etiqueta bg-verde/15 text-verde">marca pronta</span> : <span className="adefinir">falta: {falta.join(", ")}</span>}
              </summary>
              <FormAcao acao={salvarMarca} botao="Salvar marca" className="mt-4">
                <input type="hidden" name="empresaId" value={e.id} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Campo rotulo="Razão social" nome="razaoSocial" valor={m.razaoSocial} />
                  <Campo rotulo="Cidade" nome="cidade" valor={m.cidade} />
                  <Campo rotulo="Telefone" nome="telefone" valor={m.telefone} />
                  <Campo rotulo="E-mail" nome="email" valor={m.email} />
                  <Campo rotulo="Instagram" nome="instagram" valor={m.instagram} />
                  <Campo rotulo="Endereço" nome="endereco" valor={m.endereco} />
                  <Campo rotulo="Responsável técnico" nome="responsavelTecnico" valor={m.responsavelTecnico} />
                  <Campo rotulo="Registro (CAU ou CREA)" nome="registro" valor={m.registro} />
                  <Campo rotulo="Cor principal (ex.: #0D2F63)" nome="azul" valor={m.azul} />
                  <Campo rotulo="Cor de destaque (ex.: #C79B63)" nome="dourado" valor={m.dourado} />
                  <Campo rotulo="Fundo claro" nome="offwhite" valor={m.offwhite} dica="#F7F4EE" />
                  <Campo rotulo="Fundo de cards" nome="bege" valor={m.bege} dica="#E8DFD2" />
                  <Campo rotulo="Linhas" nome="begeLinha" valor={m.begeLinha} dica="#D9C9A3" />
                  <Campo rotulo="Fonte" nome="fonte" valor={m.fonte} dica="Montserrat" />
                  <label className="block"><span className="rotulo">Logo para fundo escuro (PNG) {m.logoClaro ? "✓" : ""}</span><input type="file" name="logoClaro" accept="image/png" className="campo" /></label>
                  <label className="block"><span className="rotulo">Logo para fundo claro (PNG) {m.logoEscuro ? "✓" : ""}</span><input type="file" name="logoEscuro" accept="image/png" className="campo" /></label>
                </div>
              </FormAcao>
            </details>
          );
        })}
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="cartao">
          <h2 className="titulo mb-3 text-sm">Usuários</h2>
          <ul className="mb-4 space-y-1 text-sm">{usuarios.map((u) => <li key={u.id}>{u.nome} <span className="text-cinza">· {u.email}</span></li>)}</ul>
          <FormAcao acao={criarUsuario} botao="Adicionar usuário" classeBotao="botao-leve">
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block"><span className="rotulo">Nome</span><input name="nome" required className="campo" /></label>
              <label className="block"><span className="rotulo">E-mail</span><input name="email" type="email" required className="campo" /></label>
              <label className="block"><span className="rotulo">Senha (mín. 8)</span><input name="senha" type="password" minLength={8} required className="campo" /></label>
            </div>
          </FormAcao>
        </div>
        <div className="cartao space-y-2 text-sm">
          <h2 className="titulo mb-1 text-sm">Situação do sistema</h2>
          <p>Banco de dados: <strong>{usaSupabase() ? "Supabase (nuvem)" : "arquivo local neste computador"}</strong></p>
          <p>Leitura automática da planta (API do Claude): <strong>{iaDisponivel() ? "ligada" : "desligada (chave não cadastrada)"}</strong></p>
          <p className="text-xs text-cinza">Para ligar o Supabase ou a leitura automática, siga o arquivo LEIA-ME.md na pasta do sistema. As chaves ficam só no servidor.</p>
        </div>
      </section>
    </div>
  );
}
