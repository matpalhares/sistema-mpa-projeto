"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

// Upload com barra de progresso. O arquivo vai direto ao servidor.
export function EnvioArquivo({ projetoId }: { projetoId: string }) {
  const router = useRouter();
  const [pct, setPct] = useState<number | null>(null);
  const [erro, setErro] = useState("");
  function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const dados = new FormData(form);
    if (!(dados.get("arquivo") instanceof File) || (dados.get("arquivo") as File).size === 0) { setErro("Escolha um arquivo."); return; }
    setErro(""); setPct(0);
    const x = new XMLHttpRequest();
    x.open("POST", "/api/enviar");
    x.upload.onprogress = (ev) => ev.lengthComputable && setPct(Math.round((ev.loaded / ev.total) * 100));
    x.onload = () => { setPct(null); if (x.status === 200) { form.reset(); router.refresh(); } else setErro("Não foi possível enviar o arquivo."); };
    x.onerror = () => { setPct(null); setErro("Falha de conexão durante o envio."); };
    x.send(dados);
  }
  return (
    <form onSubmit={enviar} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="projetoId" value={projetoId} />
      <label className="block grow"><span className="rotulo">Arquivo</span><input type="file" name="arquivo" className="campo" /></label>
      <label className="block"><span className="rotulo">O que é?</span>
        <select name="categoria" className="campo"><option value="planta">Planta baixa (imagem ou PDF)</option><option value="sketchup">SketchUp</option><option value="contrato">Contrato</option><option value="outro">Outro</option></select>
      </label>
      <button className="botao" disabled={pct != null}>{pct != null ? `Enviando ${pct}%` : "Enviar"}</button>
      {pct != null && <div className="h-2 w-full overflow-hidden rounded-full bg-bege"><div className="h-full bg-dourado transition-all" style={{ width: pct + "%" }} /></div>}
      {erro && <p className="aviso w-full" role="alert">{erro}</p>}
    </form>
  );
}
