'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import exemploCamera from '@/assets/images/example.png';
import { supabase } from '@/lib/supabase';
import { COUNTRY_FLAGS, SECOES_ALBUM } from '@/utils/constants';

type CameraStatus = 'iniciando' | 'ativa' | 'erro';

interface RegistroSessao {
  codigo: string;
  tipo: 'conquistada' | 'repetida';
  quantidade: number;
}

interface TesseractGlobal {
  recognize: (
    image: HTMLCanvasElement,
    language: string,
    options?: {
      logger?: (message: { status?: string; progress?: number }) => void;
      tessedit_char_whitelist?: string;
    }
  ) => Promise<{ data: { text: string } }>;
}

declare global {
  interface Window {
    Tesseract?: TesseractGlobal;
  }
}

const STICKER_FRAME = {
  x: 0.141,
  y: 0.14,
  width: 0.7,
  height: 0.7,
};

const CODE_FRAME = {
  x: STICKER_FRAME.x + STICKER_FRAME.width - 0.04 - STICKER_FRAME.width * 0.42,
  y: STICKER_FRAME.y + 0.02,
  width: STICKER_FRAME.width * 0.45,
  height: STICKER_FRAME.height * 0.14,
};

const CAMERA_VIEW_RATIO = 3 / 4;
const INTERVALO_DETECCAO_MS = 2600;
const TESSERACT_CDN = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
const CHAVE_INSTRUCOES_CAMERA = 'albumcopa2026:camera-instrucoes-vistas';

let tesseractPromise: Promise<TesseractGlobal> | null = null;

const aguardar = (ms: number) => new Promise(resolve => {
  window.setTimeout(resolve, ms);
});

const cameraPareceFrontal = (label: string) => {
  return /front|frontal|selfie|user/i.test(label);
};

const cameraPareceUltraWide = (label: string) => {
  return /ultra|wide|0\.5|0,5|grande angular|macro/i.test(label);
};

const cameraPareceTraseira = (label: string) => {
  return /back|rear|traseira|environment|facing back|facing rear/i.test(label);
};

const cameraParecePrincipal = (label: string) => {
  return /main|principal|standard|normal|camera2\s*0|camera\s*0|back camera/i.test(label);
};

const pontuarCamera = (camera: MediaDeviceInfo) => {
  const label = camera.label.toLowerCase();
  let pontos = 0;

  if (cameraParecePrincipal(label)) pontos += 80;
  if (cameraPareceTraseira(label)) pontos += 40;
  if (/camera2\s*0|camera\s*0|device\s*0/i.test(label)) pontos += 30;
  if (/tele|zoom|2x|3x/i.test(label)) pontos -= 20;
  if (cameraPareceUltraWide(label)) pontos -= 120;
  if (cameraPareceFrontal(label)) pontos -= 200;

  return pontos;
};

const escolherCameraPrincipal = (cameras: MediaDeviceInfo[]) => {
  return cameras
    .map((camera, index) => ({ camera, index, pontos: pontuarCamera(camera) }))
    .filter(item => !cameraPareceFrontal(item.camera.label))
    .sort((a, b) => b.pontos - a.pontos || a.index - b.index)[0]?.camera || null;
};

const carregarTesseract = () => {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('OCR indisponível fora do navegador.'));
  }

  if (window.Tesseract) {
    return Promise.resolve(window.Tesseract);
  }

  if (!tesseractPromise) {
    tesseractPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = TESSERACT_CDN;
      script.async = true;
      script.onload = () => {
        if (window.Tesseract) {
          resolve(window.Tesseract);
        } else {
          tesseractPromise = null;
          reject(new Error('OCR carregado, mas não inicializado.'));
        }
      };
      script.onerror = () => {
        tesseractPromise = null;
        reject(new Error('Não foi possível carregar o OCR.'));
      };
      document.head.appendChild(script);
    });
  }

  return tesseractPromise;
};

const normalizarNumero = (valor: string) => {
  return valor
    .replace(/[IL|]/g, '1')
    .replace(/[OoQ]/g, '0')
    .replace(/[Ss]/g, '5')
    .replace(/[^0-9]/g, '');
};

const extrairCodigoValido = (texto: string) => {
  const compactado = texto.toUpperCase().replace(/[^A-Z0-9|]/g, '');

  for (const secao of SECOES_ALBUM) {
    const match = compactado.match(new RegExp(`${secao.prefixo}([0-9ILOQ|]{1,2})`));
    if (!match) continue;

    const numero = Number(normalizarNumero(match[1]));
    if (numero >= 1 && numero <= secao.total) {
      return `${secao.prefixo}${numero}`;
    }
  }

  return null;
};

const obterSecao = (codigo: string) => {
  return SECOES_ALBUM.find(secao => codigo.startsWith(secao.prefixo));
};

const afinarTextoBranco = (imageData: ImageData) => {
  const { data, width, height } = imageData;
  const original = new Uint8ClampedArray(data);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const index = (y * width + x) * 4;
      if (original[index] !== 255) continue;

      let vizinhosPretos = 0;

      for (let offsetY = -1; offsetY <= 1; offsetY++) {
        for (let offsetX = -1; offsetX <= 1; offsetX++) {
          if (offsetX === 0 && offsetY === 0) continue;

          const vizinhoIndex = ((y + offsetY) * width + x + offsetX) * 4;
          if (original[vizinhoIndex] === 0) {
            vizinhosPretos++;
          }
        }
      }

      if (vizinhosPretos >= 2) {
        data[index] = 0;
        data[index + 1] = 0;
        data[index + 2] = 0;
      }
    }
  }
};

const criarCanvasProcessado = (canvasOrigem: HTMLCanvasElement, inverterCores: boolean, afinarBranco: boolean) => {
  const canvas = document.createElement('canvas');
  canvas.width = canvasOrigem.width;
  canvas.height = canvasOrigem.height;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  ctx.drawImage(canvasOrigem, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const cinza = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    const contraste = cinza > 145 ? 255 : 0;
    const valor = inverterCores ? 255 - contraste : contraste;

    data[i] = valor;
    data[i + 1] = valor;
    data[i + 2] = valor;
  }

  if (afinarBranco) {
    afinarTextoBranco(imageData);
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
};

export default function InsercaoCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const codigoPendenteRef = useRef<string | null>(null);
  const cameraPrincipalIdRef = useRef<string | null>(null);
  const tentativaCameraRef = useRef(0);

  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('iniciando');
  const [erro, setErro] = useState('');
  const [codigoPendente, setCodigoPendente] = useState<string | null>(null);
  const [detectando, setDetectando] = useState(false);
  const [detectorPausado, setDetectorPausado] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [registros, setRegistros] = useState<RegistroSessao[]>([]);
  const [codigoManual, setCodigoManual] = useState('');
  const [mostrarInstrucoes, setMostrarInstrucoes] = useState(false);
  const [salvandoCodigo, setSalvandoCodigo] = useState(false);

  const abrirConfirmacao = useCallback((codigo: string) => {
    codigoPendenteRef.current = codigo;
    setCodigoPendente(codigo);
    setMensagem('');
  }, []);

  const fecharConfirmacao = useCallback(() => {
    codigoPendenteRef.current = null;
    setCodigoPendente(null);
  }, []);

  const pararCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const iniciarCamera = useCallback(async () => {
    const tentativaAtual = tentativaCameraRef.current + 1;
    tentativaCameraRef.current = tentativaAtual;
    const tentativaAindaAtual = () => tentativaCameraRef.current === tentativaAtual;

    setCameraStatus('iniciando');
    setErro('');

    if (!window.isSecureContext) {
      setCameraStatus('erro');
      setErro('A câmera exige HTTPS no celular. Abra a aplicação por uma URL https ou use um túnel seguro para testar.');
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraStatus('erro');
      setErro('Câmera indisponível neste navegador. Verifique se a página está em HTTPS e se o navegador tem permissão para usar a câmera.');
      return;
    }

    try {
      pararCamera();

      const abrirStream = (deviceId?: string) => navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: 'environment' } }),
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });

      let stream: MediaStream;

      try {
        stream = await abrirStream(cameraPrincipalIdRef.current || undefined);
      } catch (error) {
        if (!cameraPrincipalIdRef.current) {
          throw error;
        }

        cameraPrincipalIdRef.current = null;
        stream = await abrirStream();
      }

      if (!tentativaAindaAtual()) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }

      const dispositivoAtualId = stream.getVideoTracks()[0]?.getSettings().deviceId;

      const dispositivos = await navigator.mediaDevices.enumerateDevices();

      if (!tentativaAindaAtual()) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }

      const cameras = dispositivos.filter(dispositivo => dispositivo.kind === 'videoinput');
      const cameraPrincipal = escolherCameraPrincipal(cameras);

      if (cameraPrincipal?.deviceId) {
        cameraPrincipalIdRef.current = cameraPrincipal.deviceId;
      }

      if (cameraPrincipal?.deviceId && cameraPrincipal.deviceId !== dispositivoAtualId) {
        stream.getTracks().forEach(track => track.stop());

        try {
          await aguardar(250);
          stream = await abrirStream(cameraPrincipal.deviceId);
        } catch {
          cameraPrincipalIdRef.current = null;
          await aguardar(250);
          stream = await abrirStream();
        }
      }

      if (!tentativaAindaAtual()) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      if (!tentativaAindaAtual()) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }

      setErro('');
      setCameraStatus('ativa');
    } catch {
      if (!tentativaAindaAtual()) return;

      setCameraStatus('erro');
      setErro('Não foi possível acessar a câmera. Verifique a permissão do navegador.');
    }
  }, [pararCamera]);

  useEffect(() => {
    iniciarCamera();

    return () => {
      tentativaCameraRef.current += 1;
      pararCamera();
    };
  }, [iniciarCamera, pararCamera]);

  useEffect(() => {
    try {
      setMostrarInstrucoes(window.localStorage.getItem(CHAVE_INSTRUCOES_CAMERA) !== 'true');
    } catch {
      setMostrarInstrucoes(true);
    }
  }, []);

  const capturarAreaDaMoldura = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || video.videoWidth === 0 || video.videoHeight === 0) {
      return null;
    }

    const videoRatio = video.videoWidth / video.videoHeight;
    const renderedWidth = videoRatio > CAMERA_VIEW_RATIO
      ? videoRatio / CAMERA_VIEW_RATIO
      : 1;
    const renderedHeight = videoRatio > CAMERA_VIEW_RATIO
      ? 1
      : CAMERA_VIEW_RATIO / videoRatio;
    const offsetX = (1 - renderedWidth) / 2;
    const offsetY = (1 - renderedHeight) / 2;

    const origemX = video.videoWidth * ((CODE_FRAME.x - offsetX) / renderedWidth);
    const origemY = video.videoHeight * ((CODE_FRAME.y - offsetY) / renderedHeight);
    const largura = video.videoWidth * (CODE_FRAME.width / renderedWidth);
    const altura = video.videoHeight * (CODE_FRAME.height / renderedHeight);
    const escala = 2;

    canvas.width = Math.round(largura * escala);
    canvas.height = Math.round(altura * escala);

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    ctx.drawImage(video, origemX, origemY, largura, altura, 0, 0, canvas.width, canvas.height);
    return canvas;
  }, []);

  const processarTextoDetectado = useCallback((texto: string) => {
    const codigo = extrairCodigoValido(texto);
    if (codigo && !codigoPendenteRef.current) {
      abrirConfirmacao(codigo);
      return true;
    }

    return false;
  }, [abrirConfirmacao]);

  const analisarComVariantes = useCallback(async (tesseract: TesseractGlobal, canvasBase: HTMLCanvasElement) => {
    const variantes = [
      { afinarBranco: false, inverterCores: false },
      { afinarBranco: false, inverterCores: true },
      { afinarBranco: true, inverterCores: false },
      { afinarBranco: true, inverterCores: true },
    ];

    for (const variante of variantes) {
      const canvasProcessado = criarCanvasProcessado(canvasBase, variante.inverterCores, variante.afinarBranco);
      if (!canvasProcessado) continue;

      const resultado = await tesseract.recognize(canvasProcessado, 'eng', {
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
      });
      const codigo = extrairCodigoValido(resultado.data.text);

      if (codigo) {
        return { codigo, motivo: '' };
      }
    }

    return { codigo: null, motivo: 'Aguardando código válido na moldura.' };
  }, []);

  const detectarCodigo = useCallback(async () => {
    if (detectando || detectorPausado || mostrarInstrucoes || codigoPendenteRef.current || cameraStatus !== 'ativa') return;

    const canvas = capturarAreaDaMoldura();
    if (!canvas) return;

    setDetectando(true);

    try {
      const tesseract = await carregarTesseract();
      const resultado = await analisarComVariantes(tesseract, canvas);
      const encontrouCodigo = resultado.codigo ? processarTextoDetectado(resultado.codigo) : false;

      if (!encontrouCodigo) {
        setMensagem(resultado.motivo);
      }
    } catch {
      setMensagem('Não foi possível analisar a imagem agora. Tente novamente.');
    } finally {
      setDetectando(false);
    }
  }, [
    cameraStatus,
    analisarComVariantes,
    capturarAreaDaMoldura,
    detectando,
    detectorPausado,
    mostrarInstrucoes,
    processarTextoDetectado,
  ]);

  useEffect(() => {
    if (cameraStatus !== 'ativa' || detectorPausado || mostrarInstrucoes || codigoPendente) return;

    const intervalo = window.setInterval(() => {
      detectarCodigo();
    }, INTERVALO_DETECCAO_MS);

    return () => {
      window.clearInterval(intervalo);
    };
  }, [cameraStatus, codigoPendente, detectarCodigo, detectorPausado, mostrarInstrucoes]);

  const registrarCodigoNoAlbum = async (codigo: string): Promise<RegistroSessao> => {
    const { data: userData, error: erroUsuario } = await supabase.auth.getUser();
    const userId = userData.user?.id;

    if (erroUsuario || !userId) {
      throw new Error('Usuário não autenticado.');
    }

    const { data: obtidaAtual, error: erroObtida } = await supabase
      .from('obtidas')
      .select('codigo')
      .eq('user_id', userId)
      .eq('codigo', codigo)
      .maybeSingle();

    if (erroObtida) {
      throw erroObtida;
    }

    if (!obtidaAtual) {
      const { error: erroInsertObtida } = await supabase
        .from('obtidas')
        .insert({ user_id: userId, codigo });

      if (!erroInsertObtida) {
        return { codigo, tipo: 'conquistada', quantidade: 1 };
      }

      if (erroInsertObtida.code !== '23505') {
        throw erroInsertObtida;
      }
    }

    const { data: repetidaAtual, error: erroRepetida } = await supabase
      .from('repetidas')
      .select('quantidade')
      .eq('user_id', userId)
      .eq('codigo', codigo)
      .maybeSingle();

    if (erroRepetida) {
      throw erroRepetida;
    }

    const novaQuantidade = (repetidaAtual?.quantidade || 0) + 1;
    const { error: erroUpsertRepetida } = await supabase
      .from('repetidas')
      .upsert(
        { user_id: userId, codigo, quantidade: novaQuantidade },
        { onConflict: 'user_id,codigo' }
      );

    if (erroUpsertRepetida) {
      throw erroUpsertRepetida;
    }

    return { codigo, tipo: 'repetida', quantidade: novaQuantidade };
  };

  const confirmarCodigo = async () => {
    if (!codigoPendente) return;
    const codigoConfirmado = codigoPendente;

    setSalvandoCodigo(true);

    try {
      const registro = await registrarCodigoNoAlbum(codigoConfirmado);

      setRegistros(prev => {
        const existente = prev.some(item => item.codigo === registro.codigo);

        if (!existente) {
          return [registro, ...prev];
        }

        return prev.map(item => item.codigo === registro.codigo ? registro : item);
      });

      setMensagem(
        registro.tipo === 'conquistada'
          ? `${registro.codigo} registrada como conquistada.`
          : `${registro.codigo} registrada como repetida. Total de repetidas: ${registro.quantidade}.`
      );
      fecharConfirmacao();
    } catch {
      setMensagem('Não foi possível salvar este código. Tente confirmar novamente.');
    } finally {
      setSalvandoCodigo(false);
    }
  };

  const recusarCodigo = () => {
    setMensagem('Leitura recusada. Scanner retomado.');
    fecharConfirmacao();
  };

  const fecharInstrucoes = () => {
    try {
      window.localStorage.setItem(CHAVE_INSTRUCOES_CAMERA, 'true');
    } catch {
      // Segue sem persistir se o navegador bloquear o localStorage.
    }

    setMostrarInstrucoes(false);
  };

  const confirmarCodigoManual = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (salvandoCodigo) return;

    const codigo = extrairCodigoValido(codigoManual);

    if (!codigo) {
      setMensagem('Código inválido para o álbum.');
      return;
    }

    setCodigoManual('');
    abrirConfirmacao(codigo);
  };

  const secaoPendente = codigoPendente ? obterSecao(codigoPendente) : null;
  const bandeiraPendente = secaoPendente ? COUNTRY_FLAGS[secaoPendente.prefixo] : '';

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Registro por Câmera</h1>
            <div className="mt-1 flex items-center gap-2">
              <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Salva direto no álbum</p>
              <button
                type="button"
                onClick={() => setMostrarInstrucoes(true)}
                aria-label="Abrir instruções do registro por câmera"
                className="flex h-5 w-5 items-center justify-center rounded-full border border-gray-300 bg-white text-xs font-black text-gray-600 shadow-sm"
              >
                i
              </button>
            </div>
          </div>
          <Link href="/" className="text-sm font-bold text-blue-600">
            Voltar
          </Link>
        </div>

        <div className="relative bg-black rounded-xl overflow-hidden shadow-md border border-gray-200 aspect-[3/4]">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
          />

          <div className="absolute inset-0 pointer-events-none">
            <div
              className={`absolute border-2 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.42)] ${codigoPendente ? 'border-green-400' : 'border-blue-400'
                }`}
              style={{
                left: `${STICKER_FRAME.x * 100}%`,
                top: `${STICKER_FRAME.y * 100}%`,
                width: `${STICKER_FRAME.width * 100}%`,
                height: `${STICKER_FRAME.height * 100}%`,
              }}
            >
              <span className="absolute -top-7 left-0 text-xs font-bold uppercase tracking-wider text-white drop-shadow">
                Alinhe a figurinha
              </span>
            </div>

            <div
              className="absolute rounded border-2 border-yellow-300 bg-yellow-300/10"
              style={{
                left: `${CODE_FRAME.x * 100}%`,
                top: `${CODE_FRAME.y * 100}%`,
                width: `${CODE_FRAME.width * 100}%`,
                height: `${CODE_FRAME.height * 100}%`,
              }}
            >
              <span className="absolute -bottom-6 left-0 whitespace-nowrap text-[10px] font-black uppercase tracking-wider text-yellow-200 drop-shadow">
                Área do código
              </span>
            </div>
          </div>

          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2">
            <span className="rounded-lg bg-black/70 px-3 py-2 text-xs font-bold text-white">
              {cameraStatus === 'ativa' && !codigoPendente && (detectando ? 'Analisando...' : 'Escaneando')}
              {cameraStatus === 'ativa' && codigoPendente && (salvandoCodigo ? 'Salvando' : 'Aguardando confirmação')}
              {cameraStatus === 'iniciando' && 'Abrindo câmera'}
              {cameraStatus === 'erro' && 'Câmera indisponível'}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDetectorPausado(prev => !prev)}
                disabled={cameraStatus !== 'ativa' || Boolean(codigoPendente) || salvandoCodigo}
                className="rounded-lg bg-white/90 px-3 py-2 text-xs font-black text-gray-800 disabled:opacity-50"
              >
                {detectorPausado ? 'Retomar' : 'Pausar'}
              </button>
            </div>
          </div>
        </div>

        <canvas ref={canvasRef} className="hidden" />

        {erro && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
            {erro}
            <button
              type="button"
              onClick={iniciarCamera}
              className="mt-3 w-full rounded-lg bg-red-600 px-3 py-2 text-sm font-bold text-white"
            >
              Tentar novamente
            </button>
          </div>
        )}

        {mensagem && (
          <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm font-medium text-blue-800">
            {mensagem}
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={detectarCodigo}
            disabled={cameraStatus !== 'ativa' || detectando || Boolean(codigoPendente) || salvandoCodigo}
            className="rounded-xl bg-blue-600 px-3 py-3 text-sm font-bold text-white shadow-sm disabled:bg-gray-300"
          >
            {detectando ? 'Analisando...' : 'Analisar agora'}
          </button>
          <button
            type="button"
            onClick={() => {
              setMensagem('');
              setRegistros([]);
            }}
            className="rounded-xl bg-white px-3 py-3 text-sm font-bold text-gray-700 shadow-sm border border-gray-200"
          >
            Limpar sessão
          </button>
        </div>

        <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-bold text-gray-800">Leituras desta sessão</h2>
            <span className="text-xs font-bold text-gray-400">{registros.length} código(s)</span>
          </div>

          {registros.length === 0 ? (
            <div className="mt-3 rounded-lg bg-gray-50 p-4 text-center text-sm font-medium text-gray-500">
              Nenhuma figurinha registrada nesta sessão.
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {registros.map(registro => {
                const secao = obterSecao(registro.codigo);
                const bandeira = secao ? COUNTRY_FLAGS[secao.prefixo] : '';

                return (
                  <span
                    key={registro.codigo}
                    className={`rounded-full px-3 py-1 text-xs font-black ${registro.tipo === 'repetida'
                      ? 'bg-orange-100 text-orange-700'
                      : 'bg-green-100 text-green-700'
                      }`}
                  >
                    {bandeira} {registro.codigo}
                    {registro.tipo === 'repetida' ? ` · ${registro.quantidade} rep.` : ''}
                  </span>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <label htmlFor="codigoManual" className="block text-sm font-bold text-gray-800">
            Inserir código manualmente
          </label>
          <form onSubmit={confirmarCodigoManual} className="mt-3 flex gap-2">
            <input
              id="codigoManual"
              value={codigoManual}
              onChange={(event) => setCodigoManual(event.target.value.toUpperCase())}
              placeholder="BRA1"
              className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-bold uppercase text-gray-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={!codigoManual.trim() || Boolean(codigoPendente) || salvandoCodigo}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:bg-gray-300"
            >
              Adicionar
            </button>
          </form>
        </div>
      </div>

      {mostrarInstrucoes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="flex max-h-[92vh] w-full max-w-sm flex-col overflow-hidden rounded-xl bg-white shadow-xl">
            <div className="overflow-y-auto p-5">
              <h2 className="text-xl font-black text-gray-900">Como escanear</h2>
              <p className="mt-2 text-sm font-medium text-gray-600">
                Posicione a parte de trás da figurinha na moldura azul e mantenha o código dentro da área amarela.
              </p>

              <div className="mt-4 overflow-hidden rounded-lg border border-gray-200 bg-gray-950">
                <Image
                  src={exemploCamera}
                  alt="Exemplo de figurinha alinhada com o código dentro da área indicada"
                  className="h-auto w-full"
                  priority
                />
              </div>

              <div className="mt-4 space-y-2 text-sm font-medium text-gray-600">
                <p>Mantenha a câmera firme e evite reflexos sobre o código.</p>
                <p>Quando o código for encontrado, confirme a leitura antes de escanear a próxima figurinha.</p>
              </div>
            </div>

            <div className="border-t border-gray-100 p-4">
              <button
                type="button"
                onClick={fecharInstrucoes}
                className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white"
              >
                Começar
              </button>
            </div>
          </div>
        </div>
      )}

      {codigoPendente && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
            <div className="text-center">
              <span className="text-5xl">{bandeiraPendente || '🏷️'}</span>
              <h2 className="mt-3 text-xl font-black text-gray-800">{codigoPendente}</h2>
              <p className="mt-1 text-sm font-medium text-gray-500">
                Ao confirmar, o sistema verifica se a figurinha já é conquistada e salva como nova ou repetida.
              </p>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={recusarCodigo}
                disabled={salvandoCodigo}
                className="rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-bold text-gray-700"
              >
                Recusar
              </button>
              <button
                type="button"
                onClick={confirmarCodigo}
                disabled={salvandoCodigo}
                className="rounded-xl bg-green-600 px-4 py-3 text-sm font-bold text-white disabled:bg-gray-300"
              >
                {salvandoCodigo ? 'Salvando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
