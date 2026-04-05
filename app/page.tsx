"use client";

import { useEffect, useState, useMemo } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import confetti from "canvas-confetti";

import { type Raridade, type Jogador } from "../lib/types";

const getFallbackImage = (nome: string) => `https://ui-avatars.com/api/?name=${encodeURIComponent(nome)}&background=eab308&color=fff&size=400`;

interface TradeInvite {
  linkId: string;         // UUID da linha em links_troca (uso único)
  jogadorNome?: string;  // Para exibir no modal (opcional, carregado pela query)
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pacoteAberto, setPacoteAberto] = useState<Jogador[]>([]);
  const [minhasFigurinhas, setMinhasFigurinhas] = useState<Jogador[]>([]);
  const [selecaoAtiva, setSelecaoAtiva] = useState<string>("Brasil");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [tradeInvite, setTradeInvite] = useState<TradeInvite | null>(null);
  const [isProcessingTrade, setIsProcessingTrade] = useState(false);
  const [jaAbriuHoje, setJaAbriuHoje] = useState<boolean>(false);
  const [isShaking, setIsShaking] = useState(false);
  const [revealedCards, setRevealedCards] = useState<number[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [mobileCardIndex, setMobileCardIndex] = useState(0);

  // Estados do Modal de Criação de Oferta de Mercado
  const [modalOfertaAberto, setModalOfertaAberto] = useState(false);
  const [ofertaJogadorId, setOfertaJogadorId] = useState<string | null>(null);
  const [ofertaDesejadoId, setOfertaDesejadoId] = useState<string>("");
  const [isPublicandoOferta, setIsPublicandoOferta] = useState(false);
  const [ofertaSearchTerm, setOfertaSearchTerm] = useState("");
  const [confirmacaoMercadoAberta, setConfirmacaoMercadoAberta] = useState(false);
  const [ofertaJogadorPendente, setOfertaJogadorPendente] = useState<string | null>(null);

  const [albumOficial, setAlbumOficial] = useState<Jogador[]>([]);
  const selecoesDisponiveis = useMemo(() => {
    return Array.from(new Set(albumOficial.map(j => j.selecao))).sort((a, b) => a.localeCompare(b));
  }, [albumOficial]);

  useEffect(() => {
    async function loadAlbum() {
      const { data, error } = await supabase.from('jogadores').select('*').order('selecao', { ascending: true });
      if (data && !error) {
        const mappedData = data.map((item: any) => ({
          ...item,
          fotoUrl: item.foto_url,
          paisCodigo: item.pais_codigo,
          // Normalização de raridade caso o BD retorne minúsculo
          raridade: item.raridade ? (item.raridade.charAt(0).toUpperCase() + item.raridade.slice(1)) : 'Comum'
        }));
        setAlbumOficial(mappedData);
      }
    }
    loadAlbum();
  }, []);
  // ENTRYPOINT: Leitura do link de troca via URL
  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const linkId = params.get("trade_id");

    if (!linkId) return;

    // Limpa a URL imediatamente para evitar reuso acidental via refresh
    const url = new URL(window.location.href);
    url.searchParams.delete("trade_id");
    window.history.replaceState({}, document.title, url.pathname + url.search);

    // Verifica se o link já foi utilizado antes de abrir o modal
    supabase
      .from("links_troca")
      .select("foi_utilizada, jogador_id")
      .eq("id", linkId)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          setToastMessage("❌ Link de troca inválido ou expirado.");
          setTimeout(() => setToastMessage(null), 4000);
          return;
        }
        if (data.foi_utilizada) {
          setToastMessage("Ops! Alguém já aceitou esta troca antes de você. 🏃‍♂️");
          setTimeout(() => setToastMessage(null), 5000);
          return;
        }
        // Link válido — abre o modal de aceite
        setTradeInvite({ linkId });
      });
  }, []);

  const figurinhasRepetidas = useMemo(() => {
    const frequencia: Record<string | number, number> = {};
    minhasFigurinhas.forEach((f) => {
      const originalId = f.jogador_id || f.id;
      frequencia[originalId] = (frequencia[originalId] || 0) + 1;
    });

    return albumOficial
      .map((j) => ({
        ...j,
        quantidadeRepetida: frequencia[j.id] ? frequencia[j.id] - 1 : 0,
      }))
      .filter((j) => j.quantidadeRepetida > 0);
  }, [minhasFigurinhas, albumOficial]);

  const abasDisponiveis = [...selecoesDisponiveis, "Minhas Trocas"];

  const getContadorSelecao = (selecao: string) => {
    if (selecao === "Minhas Trocas") {
      return figurinhasRepetidas.length.toString();
    }
    const total = albumOficial.filter(j => j.selecao === selecao).length;
    const obtidasUnicas = new Set(minhasFigurinhas.map(f => f.jogador_id || f.id));
    let countObtidas = 0;
    for (const id of Array.from(obtidasUnicas)) {
      const original = albumOficial.find(j => j.id === id);
      if (original && original.selecao === selecao) {
        countObtidas++;
      }
    }
    return `${countObtidas}/${total}`;
  };

  const exibirTrocas = selecaoAtiva === "Minhas Trocas";
  const albumDaSelecao = useMemo(() => {
    const list = exibirTrocas ? figurinhasRepetidas : albumOficial.filter(j => j.selecao === selecaoAtiva);

    // Peso para exibir a "escalação" da forma como a maioria dos álbuns faz (do goleiro ao ataque)
    const ordemPosicao: Record<string, number> = {
      "GOL": 1,
      "ZAG": 2, "DEF": 2,
      "LAT": 3, "LD": 3, "LE": 3,
      "VOL": 4,
      "MEI": 5, "MC": 5,
      "ATA": 6, "PE": 6, "PD": 6, "CA": 6
    };

    return [...list].sort((a, b) => {
      const posA = ordemPosicao[a.posicao?.toUpperCase()] || 99;
      const posB = ordemPosicao[b.posicao?.toUpperCase()] || 99;
      if (posA !== posB) return posA - posB;
      // Desempate jogando em ordem alfabética entre jogadores da mesma posição
      return a.nome.localeCompare(b.nome);
    });
  }, [exibirTrocas, figurinhasRepetidas, albumOficial, selecaoAtiva]);

  const toggleReveal = (index: number) => {
    if (revealedCards.includes(index)) return;

    const newRevealed = [...revealedCards, index];
    setRevealedCards(newRevealed);

    if (newRevealed.length === 3) {
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 }
      });
    }
  };

  const handleGerarLinkTroca = async (jogadorId: string | number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;

    // Cria um registro único na tabela links_troca
    const { data, error } = await supabase
      .from("links_troca")
      .insert({ user_id: user.id, jogador_id: String(jogadorId) })
      .select("id")
      .single();

    if (error || !data) {
      setToastMessage("❌ Não foi possível gerar o link. Tente novamente.");
      setTimeout(() => setToastMessage(null), 3000);
      return;
    }

    // URL agora carrega apenas o UUID do link — sem expor IDs do usuário
    const link = `${window.location.origin}/?trade_id=${data.id}`;
    navigator.clipboard.writeText(link).then(() => {
      setToastMessage("🔗 Link copiado! Envie para um amigo. Ele é de uso único!");
      setTimeout(() => setToastMessage(null), 3500);
    });
  };

  const fetchFigurinhas = async (uid: string) => {
    const { data } = await supabase
      .from("inventario")
      .select("*")
      .eq("user_id", uid);

    if (data) {
      const dbFigurinhas = data.map((item: any) => ({
        ...item,
        nome: item.jogador_nome,
      }));
      setMinhasFigurinhas(dbFigurinhas as Jogador[]);
    }
  };

  const checkPacoteDiario = async (uid: string) => {
    const { data } = await supabase
      .from("pacotes_abertos")
      .select("opened_at")
      .eq("user_id", uid)
      .order("opened_at", { ascending: false })
      .limit(1)
      .single();

    if (data && data.opened_at) {
      const dbDate = new Date(data.opened_at).toDateString();
      const today = new Date().toDateString();
      setJaAbriuHoje(dbDate === today);
    } else {
      setJaAbriuHoje(false);
    }
  };

  useEffect(() => {
    if (!user) {
      setMinhasFigurinhas([]);
      setJaAbriuHoje(false);
      return;
    }
    fetchFigurinhas(user.id);
    checkPacoteDiario(user.id);

  }, [user]);

  const aceitarTroca = async () => {
    if (!user || !tradeInvite) return;

    setIsProcessingTrade(true);
    try {
      // Chama a função atômica do Postgres (garante uso único e evita race condition)
      const { data: sucesso, error } = await supabase.rpc("resgatar_figurinha_atomica", {
        link_uuid: tradeInvite.linkId,
        receptor_id: user.id,
      });

      if (error) {
        console.error("Erro RPC:", error);
        setToastMessage("❌ Ocorreu um erro ao processar a troca.");
        setTradeInvite(null);
        return;
      }

      if (!sucesso) {
        setToastMessage("Ops! Alguém já aceitou esta troca antes de você. 🏃‍♂️");
        setTradeInvite(null);
        return;
      }

      setToastMessage("Figurinha nova recebida com sucesso! 🎉");
      setTradeInvite(null);
      await fetchFigurinhas(user.id);
    } catch (err) {
      console.error("Erro ao transferir:", err);
      setToastMessage("❌ Ocorreu um erro ao processar a troca.");
    } finally {
      setIsProcessingTrade(false);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleLogin = async () => {
    try {
      await supabase.auth.signInWithOAuth({
        provider: "google",
      });
    } catch (error) {
      console.error("Erro ao fazer login:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Erro ao fazer logout:", error);
    }
  };

  const publicarOferta = async () => {
    if (!user || !ofertaJogadorId || !ofertaDesejadoId) return;
    setIsPublicandoOferta(true);
    try {
      const { error } = await supabase.from("ofertas_troca").insert({
        id_ofertante: user.id,
        jogador_oferecido_id: ofertaJogadorId,
        jogador_desejado_id: ofertaDesejadoId,
        status: "aberta",
      });
      if (error) throw error;
      setToastMessage("✅ Oferta publicada no Mercado!");
      setModalOfertaAberto(false);
    } catch (err) {
      console.error("Erro ao publicar oferta:", err);
      setToastMessage("❌ Erro ao publicar oferta.");
    } finally {
      setIsPublicandoOferta(false);
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const abrirPacoteDiario = async () => {
    if (!user) return;

    // Double Check anti-fraude
    const { data: checkData } = await supabase
      .from("pacotes_abertos")
      .select("opened_at")
      .eq("user_id", user.id)
      .order("opened_at", { ascending: false })
      .limit(1)
      .single();

    if (checkData && checkData.opened_at) {
      if (new Date(checkData.opened_at).toDateString() === new Date().toDateString()) {
        setToastMessage("Você já abriu seu pacote de hoje!");
        setJaAbriuHoje(true);
        return;
      }
    }

    // Efeito de Tesão antes de gerar e sortear
    setIsShaking(true);
    setRevealedCards([]);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsShaking(false);

    // Filtra previamente por categorias
    const comuns = albumOficial.filter(j => j.raridade.toLowerCase() === 'comum');
    const raros = albumOficial.filter(j => j.raridade.toLowerCase() === 'rara' || j.raridade.toLowerCase() === 'raro');
    const epicos = albumOficial.filter(j => ['épica', 'epica', 'lendária', 'lendário', 'lendario'].includes(j.raridade.toLowerCase()));

    // Sorteia 3 jogadores diferentes aplicando pesos (Weighted Random)
    const sorteados: Jogador[] = [];
    for (let i = 0; i < 3; i++) {
      const gachaRoll = Math.random() * 100;
      let targetPool: Jogador[] = [];

      // 0 a 70 (70%): Comum
      if (gachaRoll <= 70) {
        targetPool = comuns.length > 0 ? comuns : albumOficial;
      }
      // 70.01 a 90 (20%): Raro
      else if (gachaRoll <= 90) {
        targetPool = raros.length > 0 ? raros : (comuns.length > 0 ? comuns : albumOficial);
      }
      // 90.01 a 100 (10%): Lendário/Épico
      else {
        targetPool = epicos.length > 0 ? epicos : (raros.length > 0 ? raros : (comuns.length > 0 ? comuns : albumOficial));
      }

      // Previne figurinhas repetidas no mesmo pacote se possível
      let availableFiltered = targetPool.filter(j => !sorteados.some(s => s.id === j.id));
      if (availableFiltered.length === 0) {
        availableFiltered = targetPool; // Fallback se acabarem as cartas únicas dessa raridade
      }

      const randomIndex = Math.floor(Math.random() * availableFiltered.length);
      sorteados.push(availableFiltered[randomIndex]);
    }

    // Salva no Supabase
    try {
      const records = sorteados.map(jogador => ({
        user_id: user.id,
        jogador_id: jogador.id,
        jogador_nome: jogador.nome,
        selecao: jogador.selecao,
        raridade: jogador.raridade
      }));

      const { error } = await supabase.from("inventario").insert(records);
      if (error) {
        console.error("Erro do Supabase:", error.message, error.details, error.hint);
      } else {
        setMinhasFigurinhas(prev => [...prev, ...sorteados]);

        // Registra o pacote de hoje
        await supabase.from("pacotes_abertos").insert({ user_id: user.id });
        setJaAbriuHoje(true);

        setPacoteAberto(sorteados);
        setMobileCardIndex(0);
        setIsModalOpen(true);
      }
    } catch (error) {
      console.error("Erro ao salvar pacote:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-zinc-950">
        <div className="w-10 h-10 border-4 border-green-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-500 to-green-800 p-4">
        <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center space-y-8 transform transition-all hover:scale-[1.02] duration-300">
          <div className="space-y-3">
            <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-yellow-500">
              Álbum da Copa
            </h1>
            <p className="text-gray-500 dark:text-gray-400">
              {tradeInvite
                ? "Você recebeu um convite de troca! Faça login com o Google para resgatá-lo."
                : "Colecione, troque e complete seu álbum digital."}
            </p>
          </div>

          <button
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-3 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-800 dark:text-zinc-100 py-3 px-4 rounded-xl font-semibold shadow-sm hover:bg-gray-50 dark:hover:bg-zinc-700 transition duration-200"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 24c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 21.53 7.7 24 12 24z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 4.64c1.61 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.19 14.97 0 12 0 7.7 0 3.99 2.47 2.18 6.07l3.66 2.84c.87-2.6 3.3-4.27 6.16-4.27z" />
            </svg>
            Entrar com Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 flex flex-col font-sans">
      {/* Top Bar */}
      <header className="bg-green-700 text-white shadow-md sticky top-0 z-10 w-full transition-colors duration-300">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-yellow-400 flex items-center justify-center font-black text-green-800 text-lg shadow-sm border border-yellow-300">
              {user.user_metadata?.full_name?.charAt(0).toUpperCase() || "U"}
            </div>
            <span className="font-semibold hidden sm:inline-block tracking-wide">
              {user.user_metadata?.full_name || "Usuário"}
            </span>
          </div>

          <h1 className="text-xl font-black italic tracking-tight text-white/90 drop-shadow-sm">
            ÁLBUM DE FIGURINHAS
          </h1>

          <div className="flex items-center gap-2">
            <a
              href="/mercado"
              className="text-sm font-semibold bg-yellow-400 hover:bg-yellow-300 text-green-900 px-3 py-2 rounded-xl transition-all shadow-sm active:scale-95 hidden sm:inline-flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-4H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
              Mercado
            </a>
            <button
              onClick={handleLogout}
              className="text-sm font-semibold bg-green-800 hover:bg-green-900 px-5 py-2.5 rounded-xl transition-all shadow-sm active:scale-95"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl mx-auto w-full p-4 sm:p-6 lg:p-8">

        {/* Status do Colecionador (Progresso Global) */}
        {albumOficial.length > 0 && (
          <div className="mb-8 p-5 sm:p-6 bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 transition-all hover:shadow-md">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-3 gap-2">
              <h3 className={`font-black tracking-tight text-lg sm:text-xl ${new Set(minhasFigurinhas.map(f => f.jogador_id || f.id)).size === albumOficial.length
                ? "text-transparent bg-clip-text bg-gradient-to-r from-yellow-500 to-yellow-700 dark:from-yellow-400 dark:to-yellow-600"
                : "text-zinc-800 dark:text-zinc-100"
                }`}>
                {new Set(minhasFigurinhas.map(f => f.jogador_id || f.id)).size === albumOficial.length
                  ? "ÁLBUM COMPLETO! 🏆"
                  : `Você completou ${((new Set(minhasFigurinhas.map(f => f.jogador_id || f.id)).size / albumOficial.length) * 100).toFixed(1)}% do seu álbum!`}
              </h3>
              <span className="text-xs sm:text-sm font-bold text-zinc-500 dark:text-zinc-400">
                {new Set(minhasFigurinhas.map(f => f.jogador_id || f.id)).size} de {albumOficial.length} figurinhas
              </span>
            </div>
            <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-4 overflow-hidden border border-zinc-200 dark:border-zinc-700">
              <div
                className={`h-full rounded-full transition-all duration-1000 ease-out ${new Set(minhasFigurinhas.map(f => f.jogador_id || f.id)).size === albumOficial.length
                  ? "bg-gradient-to-r from-yellow-300 via-yellow-500 to-yellow-600 shadow-[0_0_15px_rgba(234,179,8,0.6)]"
                  : "bg-gradient-to-r from-yellow-400 to-green-500"
                  }`}
                style={{ width: `${Math.min(((new Set(minhasFigurinhas.map(f => f.jogador_id || f.id)).size / albumOficial.length) * 100), 100)}%` }}
              />
            </div>
          </div>
        )}
        <div className="mb-6 md:mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-gray-800 dark:text-gray-100 tracking-tight">
              Complete as seleções e troque figurinhas com seus amigos
            </h2>
          </div>

          <button
            onClick={abrirPacoteDiario}
            disabled={jaAbriuHoje || isShaking}
            className={`flex-shrink-0 font-black px-6 py-3 rounded-xl shadow-lg transform transition-all flex items-center justify-center gap-2 ${jaAbriuHoje
              ? "bg-zinc-300 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-600 cursor-not-allowed"
              : "bg-gradient-to-r from-yellow-400 to-yellow-600 hover:from-yellow-500 hover:to-yellow-700 text-yellow-950 hover:scale-[1.02] active:scale-95"
              } ${isShaking ? "animate-shake" : ""}`}
          >
            <svg className={`w-6 h-6 ${isShaking ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" /></svg>
            {jaAbriuHoje ? "Volte Amanhã! ⏳" : (isShaking ? "CORTANDO..." : "Abrir Pacote Diário")}
          </button>
        </div>
        {/* ─── Combobox de Navegação de Seleções ─── */}
        <div className="relative mb-8 mt-6">
          {/* Botão Gatilho */}
          <button
            onClick={() => { setIsDropdownOpen(prev => !prev); setSearchTerm(""); }}
            className="flex items-center justify-between gap-3 w-full md:w-80 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 shadow-sm hover:shadow-md transition-all"
          >
            <div className="flex items-center gap-2 min-w-0">
              {selecaoAtiva !== "Minhas Trocas" && (
                <img
                  src={`https://flagcdn.com/w20/${albumOficial.find(j => j.selecao === selecaoAtiva)?.paisCodigo ?? "un"}.png`}
                  alt=""
                  className="w-5 h-auto rounded-sm flex-shrink-0"
                />
              )}
              <span className="font-black text-sm text-zinc-800 dark:text-zinc-100 truncate">
                {selecaoAtiva}
              </span>
              <span className="flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                {selecaoAtiva === "Minhas Trocas"
                  ? figurinhasRepetidas.length
                  : (() => {
                    const total = albumOficial.filter(j => j.selecao === selecaoAtiva).length;
                    return `${getContadorSelecao(selecaoAtiva)}/${total}`;
                  })()}
              </span>
            </div>
            {/* Seta animada */}
            <svg
              className={`w-4 h-4 text-zinc-500 flex-shrink-0 transition-transform duration-200 ${isDropdownOpen ? "rotate-180" : ""}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Dropdown */}
          {isDropdownOpen && (
            <>
              {/* Overlay para fechar ao clicar fora */}
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsDropdownOpen(false)}
                aria-hidden="true"
              />
              <div className="absolute z-50 mt-2 w-full md:w-80 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-2xl overflow-hidden">
                {/* Campo de Busca */}
                <div className="p-2 border-b border-zinc-100 dark:border-zinc-800">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      placeholder="Buscar seleção..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="w-full bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-yellow-400/50"
                    />
                  </div>
                </div>

                {/* Lista rolável */}
                <div className="max-h-64 overflow-y-auto scroll-smooth overscroll-contain">
                  {/* Item fixo: Minhas Trocas */}
                  {("minhas trocas".includes(searchTerm.toLowerCase()) || searchTerm === "") && (
                    <button
                      onClick={() => { setSelecaoAtiva("Minhas Trocas"); setIsDropdownOpen(false); setSearchTerm(""); }}
                      className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors ${selecaoAtiva === "Minhas Trocas"
                        ? "bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900"
                        : "hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                        }`}
                    >
                      <span className="font-bold">🔄 Minhas Trocas</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${selecaoAtiva === "Minhas Trocas" ? "bg-white/20 dark:bg-black/10" : "bg-zinc-100 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400"
                        }`}>
                        {figurinhasRepetidas.length}
                      </span>
                    </button>
                  )}

                  {/* Divisor */}
                  <div className="border-t border-zinc-100 dark:border-zinc-800" />

                  {/* Seleções filtradas */}
                  {selecoesDisponiveis
                    .filter(s => s.toLowerCase().includes(searchTerm.toLowerCase()))
                    .map(selecao => {
                      const total = albumOficial.filter(j => j.selecao === selecao).length;
                      const progresso = getContadorSelecao(selecao);
                      const flagCode = albumOficial.find(j => j.selecao === selecao)?.paisCodigo ?? "un";
                      const isAtivo = selecaoAtiva === selecao;

                      return (
                        <button
                          key={selecao}
                          onClick={() => { setSelecaoAtiva(selecao); setIsDropdownOpen(false); setSearchTerm(""); }}
                          className={`w-full flex items-center justify-between px-4 py-2.5 text-sm gap-3 transition-colors ${isAtivo
                            ? "bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900"
                            : "hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                            }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <img
                              src={`https://flagcdn.com/w20/${flagCode}.png`}
                              alt=""
                              className="w-5 h-auto rounded-sm flex-shrink-0"
                            />
                            <span className="font-semibold truncate">{selecao}</span>
                          </div>
                          <span className={`flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-md ${isAtivo ? "bg-white/20 dark:bg-black/10" : "bg-zinc-100 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400"
                            }`}>
                            {progresso}/{total}
                          </span>
                        </button>
                      );
                    })}

                  {/* Sem Resultados */}
                  {selecoesDisponiveis.filter(s => s.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 && !"minhas trocas".includes(searchTerm.toLowerCase()) && (
                    <p className="text-center text-zinc-400 text-sm py-6">Nenhuma seleção encontrada</p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Sticker Grid */}
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 sm:gap-4 lg:gap-6">
          {albumDaSelecao.map((jogadorOriginal) => {
            const num = jogadorOriginal.id;
            const figurinha = exibirTrocas ? jogadorOriginal : minhasFigurinhas.find((f) => (f.jogador_id || f.id) === num);

            if (figurinha) {
              const borderClass = figurinha.raridade === "Épica"
                ? "border-yellow-400 shadow-[0_0_20px_rgba(255,215,0,0.8)] bg-gradient-to-tr from-yellow-600 via-yellow-400 to-yellow-600"
                : figurinha.raridade === "Rara"
                  ? "border-blue-300 shadow-[0_0_15px_rgba(59,130,246,0.6)] bg-gradient-to-br from-blue-300 to-blue-500"
                  : "border-zinc-300 bg-gradient-to-br from-zinc-50 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900 border";

              const textRarityClass = figurinha.raridade === "Épica"
                ? "text-yellow-900 dark:text-yellow-900 shadow-sm"
                : figurinha.raridade === "Rara"
                  ? "text-blue-900 dark:text-blue-900 shadow-sm"
                  : "text-zinc-600 dark:text-zinc-400";

              return (
                <div
                  key={num}
                  className={`aspect-[2/3] relative rounded-xl border-4 shadow-md overflow-hidden transition-transform duration-300 hover:scale-105 hover:-translate-y-2 ${borderClass}`}
                >
                  {/* Fundo Unificado */}
                  <img
                    src={(jogadorOriginal as any).fotoUrl || getFallbackImage((jogadorOriginal as any).nome)}
                    onError={(e) => { e.currentTarget.src = getFallbackImage((jogadorOriginal as any).nome); e.currentTarget.onerror = null; }}
                    alt={figurinha.nome}
                    className="absolute inset-0 object-cover w-full h-full z-0 bg-zinc-200 dark:bg-zinc-800"
                  />

                  {/* Overlay Escuro para o Texto */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent z-0"></div>

                  {/* Efeito Condicional de Poeira Estelar (Épica) */}
                  {figurinha.raridade === "Épica" && (
                    <div className="absolute inset-x-0 bottom-0 h-1/2 bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] from-yellow-500/50 via-transparent to-transparent z-0 animate-pulse pointer-events-none"></div>
                  )}

                  {/* Badge: Bandeira */}
                  <img src={`https://flagcdn.com/w40/${jogadorOriginal.paisCodigo}.png`} alt={figurinha.selecao} className="absolute top-5 left-2 w-5 sm:w-6 h-auto shadow-sm border border-white/20 rounded-[2px] z-10" />

                  {/* Badge: Posição */}
                  <span className="absolute top-2 right-2 bg-black/50 backdrop-blur-md text-white text-[8px] sm:text-[9px] font-black px-1.5 py-0.5 rounded border border-white/10 shadow-lg z-10">
                    {(jogadorOriginal as any).posicao}
                  </span>

                  {/* Badge: Raridade */}
                  {!exibirTrocas && (
                    <div className={`absolute bottom-2 right-2 text-center font-bold text-[8px] uppercase px-1.5 py-0.5 rounded-sm backdrop-blur-md shadow-lg z-20 ${figurinha.raridade === 'Épica' ? 'bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-600 text-amber-950 border border-yellow-200' :
                      figurinha.raridade === 'Rara' ? 'bg-gradient-to-r from-blue-300 to-blue-500 text-blue-950 border border-blue-200' : 'bg-white/80 dark:bg-black/50 text-zinc-600 dark:text-zinc-300'
                      }`}>
                      {figurinha.raridade}
                    </div>
                  )}

                  {/* Notificação de Trocas */}
                  {exibirTrocas && (
                    <span className="absolute -top-1 -right-1 text-[10px] font-black px-1.5 py-0.5 bg-red-500 text-white rounded-bl shadow-sm z-20">
                      +{(jogadorOriginal as any).quantidadeRepetida}
                    </span>
                  )}

                  {/* Bloco de Texto Integrado */}
                  <div className="absolute inset-x-0 bottom-0 p-2 sm:p-2.5 flex flex-col items-start z-10">
                    <h4 className="text-[11px] sm:text-[13px] tracking-tight font-black text-white drop-shadow-md leading-tight truncate w-full">
                      {figurinha.nome}
                    </h4>
                    <span className="text-[9px] text-zinc-300 font-medium drop-shadow-sm mb-1">{(jogadorOriginal as any).idade} anos</span>

                    {exibirTrocas && (
                      <div className="w-full flex flex-col gap-1 mt-1">
                        <button
                          onClick={(e) => handleGerarLinkTroca(num, e)}
                          className="w-full text-center font-bold text-[8px] sm:text-[9px] uppercase py-1 rounded bg-zinc-800/90 hover:bg-zinc-700 text-white transition-all active:scale-95 shadow border border-transparent hover:border-white/50 backdrop-blur"
                        >
                          🔗 Trocar
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOfertaJogadorPendente(String(num));
                            setConfirmacaoMercadoAberta(true);
                          }}
                          className="w-full text-center font-bold text-[8px] sm:text-[9px] uppercase py-1 rounded bg-green-700/90 hover:bg-green-600 text-white transition-all active:scale-95 shadow border border-transparent hover:border-white/50 backdrop-blur"
                        >
                          🏾 Mercado
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            return (
              <div
                key={num}
                className="aspect-[2/3] relative rounded-xl border-2 border-dashed border-zinc-400 dark:border-zinc-700 shadow-sm overflow-hidden opacity-60 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-300 cursor-default"
              >
                {/* Imagem borrada */}
                <img
                  src={(jogadorOriginal as any).fotoUrl || getFallbackImage((jogadorOriginal as any).nome)}
                  onError={(e) => { e.currentTarget.src = getFallbackImage((jogadorOriginal as any).nome); e.currentTarget.onerror = null; }}
                  alt="?"
                  className="absolute inset-0 object-cover w-full h-full filter blur-[6px] brightness-50 z-0 bg-zinc-200 dark:bg-zinc-800"
                />

                {/* Degradê */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent z-0"></div>

                <img src={`https://flagcdn.com/w40/${jogadorOriginal.paisCodigo}.png`} alt={jogadorOriginal.selecao} className="absolute top-5 left-2 w-5 sm:w-6 h-auto drop-shadow-md opacity-30 rounded-[2px] z-10" />

                <span className="absolute top-2 right-2 bg-black/40 text-white/50 text-[8px] sm:text-[9px] font-black px-1.5 py-0.5 rounded shadow z-10">
                  {(jogadorOriginal as any).posicao}
                </span>

                {/* Conteúdo Central/Inferior */}
                <div className="absolute inset-x-0 bottom-0 p-3 flex flex-col items-center justify-end z-10">
                  <div className="w-5 h-5 rounded-full bg-zinc-300/40 dark:bg-zinc-700/40 flex items-center justify-center mb-1">
                    <svg className="w-3 h-3 text-zinc-300" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg>
                  </div>
                  <h4 className="text-[10px] sm:text-xs font-black text-zinc-300 dark:text-zinc-400 leading-tight truncate w-full text-center">
                    {jogadorOriginal.nome}
                  </h4>
                  <div className="text-center font-bold text-[8px] mt-1 uppercase px-1.5 py-0.5 rounded-full bg-zinc-300/30 dark:bg-zinc-700/50 text-zinc-300">
                    Misteriosa
                  </div>
                </div>

                {/* Número Gigante no Fundo */}
                <span className="absolute inset-0 flex items-center justify-center text-6xl font-black text-white opacity-10 select-none pointer-events-none z-0">
                  ?
                </span>
              </div>
            );
          })}
        </div>

        {/* Modal Pacote */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-3xl mx-4 p-5 sm:p-6 md:p-8 shadow-2xl relative transform transition-all scale-100 animate-in zoom-in-95 duration-200 max-h-[95dvh] flex flex-col overflow-hidden">
              <div className="text-center mb-4 sm:mb-8 flex-shrink-0">
                <h3 className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-500 to-yellow-700 uppercase tracking-widest">
                  Pacote Aberto!
                </h3>
                <p className="text-zinc-500 dark:text-zinc-400 mt-1 sm:mt-2 text-sm sm:text-base">
                  Você tirou 3 novas figurinhas.
                </p>
              </div>

              {/* Contador Mobile */}
              <div className="flex sm:hidden items-center justify-center gap-2 mb-3 flex-shrink-0">
                {pacoteAberto.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setMobileCardIndex(i)}
                    className={`w-2.5 h-2.5 rounded-full transition-all ${i === mobileCardIndex
                        ? "bg-yellow-500 scale-125"
                        : revealedCards.includes(i)
                          ? "bg-green-500/60"
                          : "bg-zinc-300 dark:bg-zinc-600"
                      }`}
                  />
                ))}
                <span className="text-xs font-bold text-zinc-400 ml-2">Carta {mobileCardIndex + 1} de {pacoteAberto.length}</span>
              </div>

              {/* Desktop: todas as cartas lado a lado */}
              <div className="hidden sm:flex items-center justify-center gap-6 mb-8 flex-shrink-0">
                {pacoteAberto.map((jogador, index) => {
                  const isRevealed = revealedCards.includes(index);
                  const isEpica = jogador.raridade === "Épica";
                  const isRara = jogador.raridade === "Rara";
                  const borderClass = isEpica
                    ? "border-yellow-400 shadow-[0_0_20px_rgba(255,215,0,0.8)] bg-gradient-to-tr from-yellow-600 via-yellow-400 to-yellow-600"
                    : isRara
                      ? "border-blue-300 shadow-[0_0_15px_rgba(59,130,246,0.6)] bg-gradient-to-br from-blue-300 to-blue-500"
                      : "border-zinc-300 bg-gradient-to-br from-zinc-50 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900";

                  return (
                    <div key={index} className="group [perspective:1000px] cursor-pointer" onClick={() => toggleReveal(index)}>
                      <div className={`relative w-56 h-80 shadow-2xl transition-transform duration-700 [transform-style:preserve-3d] ${isRevealed ? "" : "[transform:rotateY(180deg)]"}`}>
                        {/* Front */}
                        <div className={`absolute inset-0 flex flex-col rounded-xl border-4 overflow-hidden transition-all w-full h-full [backface-visibility:hidden] ${borderClass}`}>
                          {isRevealed && (
                            <>
                              <img src={jogador.fotoUrl || getFallbackImage(jogador.nome)} onError={(e) => { e.currentTarget.src = getFallbackImage(jogador.nome); e.currentTarget.onerror = null; }} alt={jogador.nome} className="absolute inset-0 object-cover w-full h-full z-0 bg-zinc-200 dark:bg-zinc-800" />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent z-0" />
                              {isEpica && <div className="absolute inset-x-0 bottom-0 h-1/2 bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] from-yellow-500/50 via-transparent to-transparent z-0 animate-pulse pointer-events-none" />}
                              <img src={`https://flagcdn.com/w40/${jogador.paisCodigo}.png`} alt={jogador.selecao} className="absolute top-4 left-3 w-8 h-auto shadow-sm border border-white/20 rounded-[2px] z-10" />
                              <span className="absolute top-2 right-2 bg-black/60 backdrop-blur text-white text-xs font-black px-2 py-1 rounded border border-white/10 shadow-lg z-10">{jogador.posicao}</span>
                              <div className={`absolute bottom-3 right-3 text-center font-bold text-xs uppercase px-2 py-0.5 rounded-sm backdrop-blur-md shadow-2xl z-20 ${isEpica ? 'bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-600 text-amber-950 border border-yellow-200' : isRara ? 'bg-gradient-to-r from-blue-300 to-blue-500 text-blue-950 border border-blue-200' : 'bg-white/80 dark:bg-black/50 text-zinc-600 dark:text-zinc-300'}`}>{jogador.raridade}</div>
                              <div className="absolute inset-x-0 bottom-0 p-4 flex flex-col items-start z-10">
                                <h4 className="text-lg font-black text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] leading-tight truncate w-full">{jogador.nome}</h4>
                                <span className="text-xs text-zinc-300 font-medium drop-shadow-md">{jogador.idade} anos</span>
                              </div>
                            </>
                          )}
                        </div>
                        {/* Back */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center rounded-xl border-4 border-green-400 dark:border-green-600 p-4 w-full h-full [backface-visibility:hidden] [transform:rotateY(180deg)] bg-gradient-to-br from-green-700 to-green-900">
                          <svg className="w-16 h-16 text-yellow-400 mb-4 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          <span className="text-sm font-black text-white/90 uppercase tracking-widest text-center drop-shadow-md">Toque<br />Para Virar</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Mobile: carrossel de uma carta por vez */}
              <div className="flex sm:hidden flex-col items-center flex-1 min-h-0">
                <div className="relative flex items-center justify-center w-full flex-1 min-h-0">
                  {/* Seta Esquerda */}
                  {mobileCardIndex > 0 && (
                    <button
                      onClick={() => setMobileCardIndex(prev => prev - 1)}
                      className="absolute left-0 z-30 w-8 h-8 rounded-full bg-white/20 dark:bg-black/30 backdrop-blur flex items-center justify-center text-white active:scale-90 transition-transform"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                  )}

                  {/* Carta ativa */}
                  {pacoteAberto.map((jogador, index) => {
                    if (index !== mobileCardIndex) return null;
                    const isRevealed = revealedCards.includes(index);
                    const isEpica = jogador.raridade === "Épica";
                    const isRara = jogador.raridade === "Rara";
                    const borderClass = isEpica
                      ? "border-yellow-400 shadow-[0_0_20px_rgba(255,215,0,0.8)] bg-gradient-to-tr from-yellow-600 via-yellow-400 to-yellow-600"
                      : isRara
                        ? "border-blue-300 shadow-[0_0_15px_rgba(59,130,246,0.6)] bg-gradient-to-br from-blue-300 to-blue-500"
                        : "border-zinc-300 bg-gradient-to-br from-zinc-50 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900";

                    return (
                      <div key={index} className="[perspective:1000px] cursor-pointer" onClick={() => toggleReveal(index)}>
                        <div className={`relative w-52 h-72 shadow-2xl transition-transform duration-700 [transform-style:preserve-3d] ${isRevealed ? "" : "[transform:rotateY(180deg)]"}`}>
                          {/* Front */}
                          <div className={`absolute inset-0 flex flex-col rounded-xl border-4 overflow-hidden transition-all w-full h-full [backface-visibility:hidden] ${borderClass}`}>
                            {isRevealed && (
                              <>
                                <img src={jogador.fotoUrl || getFallbackImage(jogador.nome)} onError={(e) => { e.currentTarget.src = getFallbackImage(jogador.nome); e.currentTarget.onerror = null; }} alt={jogador.nome} className="absolute inset-0 object-cover w-full h-full z-0 bg-zinc-200 dark:bg-zinc-800" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent z-0" />
                                {isEpica && <div className="absolute inset-x-0 bottom-0 h-1/2 bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] from-yellow-500/50 via-transparent to-transparent z-0 animate-pulse pointer-events-none" />}
                                <img src={`https://flagcdn.com/w40/${jogador.paisCodigo}.png`} alt={jogador.selecao} className="absolute top-4 left-3 w-7 h-auto shadow-sm border border-white/20 rounded-[2px] z-10" />
                                <span className="absolute top-2 right-2 bg-black/60 backdrop-blur text-white text-[10px] font-black px-2 py-1 rounded border border-white/10 shadow-lg z-10">{jogador.posicao}</span>
                                <div className={`absolute bottom-3 right-3 text-center font-bold text-[10px] uppercase px-2 py-0.5 rounded-sm backdrop-blur-md shadow-2xl z-20 ${isEpica ? 'bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-600 text-amber-950 border border-yellow-200' : isRara ? 'bg-gradient-to-r from-blue-300 to-blue-500 text-blue-950 border border-blue-200' : 'bg-white/80 dark:bg-black/50 text-zinc-600 dark:text-zinc-300'}`}>{jogador.raridade}</div>
                                <div className="absolute inset-x-0 bottom-0 p-3 flex flex-col items-start z-10">
                                  <h4 className="text-sm font-black text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] leading-tight truncate w-full">{jogador.nome}</h4>
                                  <span className="text-[10px] text-zinc-300 font-medium drop-shadow-md">{jogador.idade} anos</span>
                                </div>
                              </>
                            )}
                          </div>
                          {/* Back */}
                          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-xl border-4 border-green-400 dark:border-green-600 p-4 w-full h-full [backface-visibility:hidden] [transform:rotateY(180deg)] bg-gradient-to-br from-green-700 to-green-900">
                            <svg className="w-14 h-14 text-yellow-400 mb-3 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            <span className="text-sm font-black text-white/90 uppercase tracking-widest text-center drop-shadow-md">Toque<br />Para Virar</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Seta Direita */}
                  {mobileCardIndex < pacoteAberto.length - 1 && (
                    <button
                      onClick={() => setMobileCardIndex(prev => prev + 1)}
                      className="absolute right-0 z-30 w-8 h-8 rounded-full bg-white/20 dark:bg-black/30 backdrop-blur flex items-center justify-center text-white active:scale-90 transition-transform"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
                    </button>
                  )}
                </div>
              </div>

              {/* Botão fixo no rodapé do modal — sempre acessível */}
              <div className={`flex justify-center pt-4 sm:pt-0 flex-shrink-0 transition-opacity duration-500 ${revealedCards.length === 3 ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="bg-zinc-800 dark:bg-zinc-100 text-white dark:text-zinc-900 font-bold px-8 py-3 rounded-full hover:bg-zinc-700 dark:hover:bg-zinc-200 transition-colors"
                >
                  Ir para o Álbum
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full py-6 mt-auto text-center text-xs sm:text-sm text-zinc-500 dark:text-zinc-600 font-medium">
        &copy; 2026 Ageu. Todos os direitos reservados. Imagens apenas para fins ilustrativos.
      </footer>

      {/* Modal de Convite de Troca */}
      {user && tradeInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-sm p-6 shadow-2xl relative transform transition-all animate-in zoom-in-95 duration-200 text-center">
            <h3 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-indigo-600 mb-2">
              Convite de Troca!
            </h3>
            <p className="text-zinc-600 dark:text-zinc-400 mb-6 font-medium">
              Você recebeu um convite de troca de figurinha. Aceitar a transferência?
            </p>

            <div className="flex flex-col gap-3">
              <button
                onClick={aceitarTroca}
                disabled={isProcessingTrade}
                className="w-full bg-blue-600 outline-none hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center disabled:opacity-50"
              >
                {isProcessingTrade ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : "Receber Figurinha"}
              </button>
              <button
                onClick={() => setTradeInvite(null)}
                disabled={isProcessingTrade}
                className="w-full bg-transparent border-2 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 font-bold py-3 px-4 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all active:scale-95 disabled:opacity-50"
              >
                Recusar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirmação de Aviso do Mercado */}
      {confirmacaoMercadoAberta && ofertaJogadorPendente && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-sm p-6 shadow-2xl text-center animate-in zoom-in-95 duration-200">
            {/* Ícone de aviso */}
            <div className="w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            </div>

            <h3 className="text-lg font-black text-zinc-800 dark:text-zinc-100 mb-2">Atenção antes de continuar!</h3>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-1">
              Você está prestes a anunciar a figurinha{" "}
              <span className="font-black text-zinc-800 dark:text-zinc-200">
                {albumOficial.find(j => String(j.id) === ofertaJogadorPendente)?.nome || "—"}
              </span>{" "}
              no Mercado de Trocas.
            </p>
            <p className="text-amber-600 dark:text-amber-400 text-sm font-bold mb-6">
              ⚠️ Uma vez publicada, a oferta não pode ser cancelada ou retirada. Ela só se encerrará quando outro jogador aceitar a troca.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => { setConfirmacaoMercadoAberta(false); setOfertaJogadorPendente(null); }}
                className="flex-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold py-3 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  setOfertaJogadorId(ofertaJogadorPendente);
                  setOfertaDesejadoId("");
                  setOfertaSearchTerm("");
                  setConfirmacaoMercadoAberta(false);
                  setOfertaJogadorPendente(null);
                  setModalOfertaAberto(true);
                }}
                className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold py-3 rounded-xl transition-all active:scale-95"
              >
                Entendi, Continuar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Criar Oferta no Mercado */}
      {modalOfertaAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-500 to-emerald-600 mb-1">Anunciar no Mercado</h3>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-5">Escolha qual figurinha você quer receber em troca.</p>

            <div className="mb-4 p-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center gap-3">
              <span className="text-xs font-bold uppercase text-zinc-400">Você oferece</span>
              <span className="font-black text-zinc-800 dark:text-zinc-100 text-sm">
                {albumOficial.find(j => String(j.id) === ofertaJogadorId)?.nome || "—"}
              </span>
            </div>

            <div className="mb-2 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </div>
              <input
                type="text"
                placeholder="Buscar figurinha desejada..."
                value={ofertaSearchTerm}
                onChange={e => setOfertaSearchTerm(e.target.value)}
                className="w-full bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 rounded-xl pl-9 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-green-400/50"
              />
            </div>

            <div className="max-h-52 overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-700 mb-5 scroll-smooth overscroll-contain">
              {albumOficial
                .filter(j => String(j.id) !== ofertaJogadorId && j.nome.toLowerCase().includes(ofertaSearchTerm.toLowerCase()))
                .map(j => (
                  <button
                    key={String(j.id)}
                    onClick={() => setOfertaDesejadoId(String(j.id))}
                    className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors ${
                      ofertaDesejadoId === String(j.id)
                        ? "bg-green-600 text-white"
                        : "hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <img src={`https://flagcdn.com/w20/${j.paisCodigo}.png`} alt="" className="w-4 h-auto rounded-sm flex-shrink-0" />
                      <span className="font-semibold truncate">{j.nome}</span>
                      <span className="text-[10px] opacity-60 flex-shrink-0">{j.selecao}</span>
                    </div>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md flex-shrink-0 ml-2 ${
                      ofertaDesejadoId === String(j.id) ? "bg-white/20" : "bg-zinc-100 dark:bg-zinc-700 text-zinc-500"
                    }`}>{j.raridade}</span>
                  </button>
                ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setModalOfertaAberto(false)}
                className="flex-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold py-3 px-4 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={publicarOferta}
                disabled={!ofertaDesejadoId || isPublicandoOferta}
                className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold py-3 px-4 rounded-xl hover:from-green-600 hover:to-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isPublicandoOferta ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : "Publicar Oferta"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notificação */}
      {toastMessage && (
        <div className="fixed bottom-6 lg:bottom-10 left-1/2 transform -translate-x-1/2 bg-zinc-900 border border-zinc-700 text-white px-5 py-3 rounded-full shadow-2xl z-50 flex items-center gap-3 animate-in slide-in-from-bottom-5 duration-300 fade-in">
          <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center">
            <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
          </div>
          <span className="font-bold text-sm tracking-wide">{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
