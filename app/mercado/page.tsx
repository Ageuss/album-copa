"use client";

import { useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { type Jogador } from "@/lib/types";
import Link from "next/link";

const getFallbackImage = (nome: string) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(nome)}&background=eab308&color=fff&size=400`;

interface Oferta {
  id: string;
  id_ofertante: string;
  jogador_oferecido_id: string;
  jogador_desejado_id: string;
  status: string;
  created_at: string;
}

export default function MercadoPage() {
  const [user, setUser] = useState<User | null>(null);
  const [albumOficial, setAlbumOficial] = useState<Jogador[]>([]);
  const [minhasFigurinhas, setMinhasFigurinhas] = useState<Jogador[]>([]);
  const [ofertas, setOfertas] = useState<Oferta[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processandoOferta, setProcessandoOferta] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
  }, []);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      // Carrega álbum oficial
      const { data: jogadores } = await supabase.from("jogadores").select("*");
      if (jogadores) {
        setAlbumOficial(
          jogadores.map((item: any) => ({
            ...item,
            fotoUrl: item.foto_url,
            paisCodigo: item.pais_codigo,
            raridade: item.raridade
              ? item.raridade.charAt(0).toUpperCase() + item.raridade.slice(1)
              : "Comum",
          }))
        );
      }

      // Carrega ofertas abertas
      const { data: ofertasData } = await supabase
        .from("ofertas_troca")
        .select("*")
        .eq("status", "aberta")
        .order("created_at", { ascending: false });
      if (ofertasData) setOfertas(ofertasData);

      setIsLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("inventario")
      .select("*")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (data) {
          setMinhasFigurinhas(
            data.map((item: any) => ({ ...item, nome: item.jogador_nome })) as Jogador[]
          );
        }
      });
  }, [user]);

  const realizarTroca = async (oferta: Oferta) => {
    if (!user) return;
    setProcessandoOferta(oferta.id);
    try {
      const { data: sucesso, error } = await supabase.rpc(
        "realizar_troca_mercado_atomica",
        { oferta_uuid: oferta.id, id_aceitante: user.id }
      );
      if (error) throw error;
      if (!sucesso) {
        showToast("❌ Troca não disponível. O dono pode não ter mais a figurinha.");
      } else {
        showToast("🎉 Troca realizada com sucesso!");
        // Atualiza lista removendo a oferta concluída
        setOfertas((prev) => prev.filter((o) => o.id !== oferta.id));
        // Atualiza inventário local
        const { data } = await supabase
          .from("inventario")
          .select("*")
          .eq("user_id", user.id);
        if (data)
          setMinhasFigurinhas(
            data.map((item: any) => ({ ...item, nome: item.jogador_nome })) as Jogador[]
          );
      }
    } catch (err) {
      console.error(err);
      showToast("❌ Erro ao realizar a troca.");
    } finally {
      setProcessandoOferta(null);
    }
  };

  const getJogador = (id: string) =>
    albumOficial.find((j) => String(j.id) === id);

  const possuiJogador = (jogadorId: string) =>
    minhasFigurinhas.some((f) => String(f.jogador_id || f.id) === jogadorId);

  const ofertasSemMinhas = user
    ? ofertas.filter((o) => o.id_ofertante !== user.id)
    : ofertas;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-green-700 text-white shadow-md sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-semibold bg-green-800 hover:bg-green-900 px-3 py-2 rounded-xl transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Voltar
          </Link>

          <h1 className="text-base sm:text-xl font-black italic tracking-tight text-white/90 drop-shadow-sm flex items-center gap-2">
            <svg className="w-5 h-5 text-yellow-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-4H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <span className="hidden sm:inline">Mercado de Trocas</span>
            <span className="inline sm:hidden">Mercado</span>
          </h1>

          <div className="w-auto sm:w-20" />
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full p-4 sm:p-6 lg:p-8">
        {!user && (
          <div className="text-center py-20 text-zinc-500 dark:text-zinc-400">
            <p className="text-lg font-semibold">Faça login para ver e realizar trocas.</p>
            <Link href="/" className="mt-4 inline-block text-green-600 underline font-bold">
              Ir para o Álbum
            </Link>
          </div>
        )}

        {user && isLoading && (
          <div className="flex justify-center items-center py-20">
            <div className="w-10 h-10 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {user && !isLoading && (
          <>
            <div className="mb-6">
              <h2 className="text-2xl font-black text-zinc-800 dark:text-zinc-100 tracking-tight">
                Ofertas Disponíveis
              </h2>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
                {ofertasSemMinhas.length === 0
                  ? "Nenhuma oferta aberta no momento."
                  : `${ofertasSemMinhas.length} oferta${ofertasSemMinhas.length > 1 ? "s" : ""} disponível${ofertasSemMinhas.length > 1 ? "is" : ""}`}
              </p>
            </div>

            {ofertasSemMinhas.length === 0 && (
              <div className="text-center py-16 text-zinc-400 dark:text-zinc-600">
                <svg className="w-16 h-16 mx-auto mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-4H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <p className="font-semibold text-lg">Mercado vazio!</p>
                <p className="text-sm mt-1">Vá ao álbum e anuncie suas repetidas.</p>
                <Link href="/" className="mt-4 inline-block bg-green-600 hover:bg-green-700 text-white font-bold px-6 py-3 rounded-xl transition-all">
                  Ir para o Álbum
                </Link>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {ofertasSemMinhas.map((oferta) => {
                const jogOferecido = getJogador(oferta.jogador_oferecido_id);
                const jogDesejado = getJogador(oferta.jogador_desejado_id);
                const podeTratar = user && possuiJogador(oferta.jogador_desejado_id);
                const isEpicaOferecida = jogOferecido?.raridade === "Épica";
                const isRaraOferecida = jogOferecido?.raridade === "Rara";

                return (
                  <div
                    key={oferta.id}
                    className={`bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border overflow-hidden transition-all hover:shadow-lg ${
                      podeTratar
                        ? "border-green-400 dark:border-green-600 shadow-green-100 dark:shadow-green-900/30"
                        : "border-zinc-200 dark:border-zinc-800"
                    }`}
                  >
                    {podeTratar && (
                      <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white text-[10px] font-black uppercase tracking-widest text-center py-1 px-3">
                        ✨ Você tem a figurinha desejada!
                      </div>
                    )}

                    <div className="p-4 flex items-center gap-3">
                      {/* Card Oferecido */}
                      <div className="flex-1 flex flex-col items-center">
                        <span className="text-[9px] uppercase font-bold text-zinc-400 mb-2">Oferece</span>
                        <div className={`relative w-20 h-28 rounded-lg border-2 overflow-hidden shadow-md ${
                          isEpicaOferecida
                            ? "border-yellow-400 shadow-yellow-300/40"
                            : isRaraOferecida
                            ? "border-blue-300 shadow-blue-200/40"
                            : "border-zinc-300"
                        }`}>
                          <img
                            src={jogOferecido?.fotoUrl || getFallbackImage(jogOferecido?.nome || "?")}
                            onError={(e) => { e.currentTarget.src = getFallbackImage(jogOferecido?.nome || "?"); e.currentTarget.onerror = null; }}
                            alt={jogOferecido?.nome || "?"}
                            className="absolute inset-0 object-cover w-full h-full"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                          {jogOferecido && (
                            <img
                              src={`https://flagcdn.com/w20/${jogOferecido.paisCodigo}.png`}
                              alt=""
                              className="absolute top-1 left-1 w-4 h-auto rounded-[2px] border border-white/20 z-10"
                            />
                          )}
                          <p className="absolute bottom-1 inset-x-0 text-center text-[8px] font-black text-white px-1 truncate z-10">
                            {jogOferecido?.nome || "—"}
                          </p>
                        </div>
                        {isEpicaOferecida && (
                          <span className="mt-1 text-[8px] font-black text-yellow-600 uppercase">✦ Épica</span>
                        )}
                        {isRaraOferecida && !isEpicaOferecida && (
                          <span className="mt-1 text-[8px] font-black text-blue-600 uppercase">★ Rara</span>
                        )}
                      </div>

                      {/* Seta */}
                      <div className="flex flex-col items-center gap-1">
                        <svg className="w-6 h-6 text-zinc-300 dark:text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                        </svg>
        
                      </div>

                      {/* Card Desejado */}
                      <div className="flex-1 flex flex-col items-center">
                        <span className="text-[9px] uppercase font-bold text-zinc-400 mb-2">Quer</span>
                        <div className={`relative w-20 h-28 rounded-lg border-2 overflow-hidden shadow-md ${
                          jogDesejado?.raridade === "Épica"
                            ? "border-yellow-400 shadow-yellow-300/40"
                            : jogDesejado?.raridade === "Rara"
                            ? "border-blue-300 shadow-blue-200/40"
                            : "border-zinc-300"
                        } ${podeTratar ? "ring-2 ring-green-400 ring-offset-1" : ""}`}>
                          <img
                            src={jogDesejado?.fotoUrl || getFallbackImage(jogDesejado?.nome || "?")}
                            onError={(e) => { e.currentTarget.src = getFallbackImage(jogDesejado?.nome || "?"); e.currentTarget.onerror = null; }}
                            alt={jogDesejado?.nome || "?"}
                            className={`absolute inset-0 object-cover w-full h-full ${!podeTratar ? "grayscale opacity-60" : ""}`}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                          {jogDesejado && (
                            <img
                              src={`https://flagcdn.com/w20/${jogDesejado.paisCodigo}.png`}
                              alt=""
                              className="absolute top-1 left-1 w-4 h-auto rounded-[2px] border border-white/20 z-10"
                            />
                          )}
                          <p className="absolute bottom-1 inset-x-0 text-center text-[8px] font-black text-white px-1 truncate z-10">
                            {jogDesejado?.nome || "—"}
                          </p>
                          {!podeTratar && (
                            <div className="absolute inset-0 flex items-center justify-center z-20">
                              <svg className="w-6 h-6 text-white/40" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM9 8V6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9z"/>
                              </svg>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Botão de ação */}
                    <div className="px-4 pb-4">
                      <button
                        onClick={() => realizarTroca(oferta)}
                        disabled={!podeTratar || processandoOferta === oferta.id}
                        className={`w-full py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                          podeTratar
                            ? "bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-md active:scale-95"
                            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600 cursor-not-allowed"
                        }`}
                      >
                        {processandoOferta === oferta.id ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : podeTratar ? (
                          "⚡ Trocar Agora"
                        ) : (
                          "Você não possui esta figurinha"
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full py-6 mt-auto text-center text-xs sm:text-sm text-zinc-500 dark:text-zinc-600 font-medium">
        &copy; 2026 Ageu. Todos os direitos reservados. Imagens apenas para fins ilustrativos.
      </footer>

      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-zinc-900 border border-zinc-700 text-white px-5 py-3 rounded-full shadow-2xl z-50 flex items-center gap-3 animate-in slide-in-from-bottom-5 duration-300">
          <span className="font-bold text-sm">{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
