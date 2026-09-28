/**
 * Hash do PIN. Roda igual no servidor e no navegador (Web Crypto).
 *
 * Formato: "pbkdf2$<iterações>$<sal base64>$<hash base64>". PBKDF2 com sal
 * aleatório e muitas iterações: descobrir um PIN de 4 dígitos a partir do
 * hash custa ~10 mil cálculos lentos por conta, em vez de uma consulta
 * numa tabela pronta (era SHA-256 puro, sem sal — igual pra todo mundo
 * que usa o mesmo PIN, e invertido em milissegundos).
 *
 * Hashes antigos (SHA-256 puro, 64 caracteres hex) ainda são aceitos, e
 * quem entra com um deles tem o hash trocado pelo formato novo na hora.
 */
const ITERACOES = 100_000;

function paraBase64(bytes: Uint8Array): string {
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s);
}

function deBase64(texto: string): Uint8Array {
  const s = atob(texto);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes;
}

async function derivar(pin: string, sal: Uint8Array, iteracoes: number): Promise<Uint8Array> {
  const chave = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: sal as BufferSource, iterations: iteracoes },
    chave,
    256
  );
  return new Uint8Array(bits);
}

async function sha256Hex(pin: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pin));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function gerarHashPin(pin: string): Promise<string> {
  const sal = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivar(pin, sal, ITERACOES);
  return `pbkdf2$${ITERACOES}$${paraBase64(sal)}$${paraBase64(hash)}`;
}

function iguais(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a[i] ^ b[i];
  return dif === 0;
}

/** Confere o PIN. `formatoAntigo` = bateu, mas o hash guardado deve ser trocado. */
export async function conferirPin(
  pin: string,
  guardado: string | undefined | null
): Promise<{ ok: boolean; formatoAntigo: boolean }> {
  if (!guardado) return { ok: false, formatoAntigo: false };
  if (guardado.startsWith("pbkdf2$")) {
    const [, iter, sal, hash] = guardado.split("$");
    const calculado = await derivar(pin, deBase64(sal), Number(iter));
    return { ok: iguais(calculado, deBase64(hash)), formatoAntigo: false };
  }
  const ok = (await sha256Hex(pin)) === guardado;
  return { ok, formatoAntigo: ok };
}
