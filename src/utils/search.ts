// Маппинг клавиатуры (QWERTY <-> ЙЦУКЕН)
const RU_KEYS = 'ёйцукенгшщзхъфывапролджэячсмитьбю.ЁЙЦУКЕНГШЩЗХЪФЫВАПРОЛДЖЭЯЧСМИТЬБЮ,"№;:?';
const EN_KEYS = '`qwertyuiop[]asdfghjkl;\'zxcvbnm,./~QWERTYUIOP{}ASDFGHJKL:"ZXCVBNM<>?@#$^&';

function createLayoutMap(from: string, to: string): Map<string, string> {
  const map = new Map();
  for (let i = 0; i < from.length; i++) {
    map.set(from[i], to[i]);
  }
  return map;
}

const enToRuMap = createLayoutMap(EN_KEYS, RU_KEYS);
const ruToEnMap = createLayoutMap(RU_KEYS, EN_KEYS);

/**
 * Меняет раскладку клавиатуры (EN <-> RU)
 */
export function switchKeyboardLayout(str: string): string {
  return str.split('').map(char => {
    return enToRuMap.get(char) || ruToEnMap.get(char) || char;
  }).join('');
}

// Расширенная транслитерация (Latin -> Cyrillic)
const TRANSLIT_MAP: Record<string, string> = {
  'sch': 'щ', 'shch': 'щ', 'ts': 'ц', 'kh': 'х', 'ya': 'я', 'yo': 'ё', 'yu': 'ю',
  'zh': 'ж', 'ch': 'ч', 'sh': 'ш', 'ph': 'ф', 
  'qu': 'кв', 'wa': 'ва', 'wo': 'во', 'wi': 'ви',
  'ck': 'к', 'th': 'т', 'wh': 'в',
  'a': 'а', 'b': 'б', 'v': 'в', 'g': 'г', 'd': 'д', 'e': 'е', 'z': 'з',
  'i': 'и', 'j': 'й', 'k': 'к', 'l': 'л', 'm': 'м', 'n': 'н', 'o': 'о',
  'p': 'п', 'r': 'р', 's': 'с', 't': 'т', 'u': 'у', 'f': 'ф', 'h': 'х',
  'c': 'к', 'y': 'и', 'x': 'кс', 'w': 'в', 'q': 'к'
};

// Обратная транслитерация (Cyrillic -> Latin)
const REVERSE_TRANSLIT_MAP: Record<string, string> = {
  'щ': 'sch', 'ё': 'yo', 'ж': 'zh', 'ч': 'ch', 'ш': 'sh', 'ю': 'yu', 'я': 'ya', 'э': 'e',
  'кс': 'x', // ВАЖНО: "Гэлакси" -> "Galaxy"
  'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'з': 'z',
  'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
  'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'h',
  'ц': 'ts', 'ы': 'y', 'ь': '', 'ъ': ''
};

// Кэшируем отсортированные ключи для правильного порядка замены (Longest match first)
const SORTED_TRANSLIT_KEYS = Object.keys(TRANSLIT_MAP).sort((a, b) => b.length - a.length);
const SORTED_REVERSE_KEYS = Object.keys(REVERSE_TRANSLIT_MAP).sort((a, b) => b.length - a.length);

export function transliterateToCyrillic(str: string): string {
  let res = str.toLowerCase();
  for (const lat of SORTED_TRANSLIT_KEYS) {
    if (res.includes(lat)) {
       res = res.replaceAll(lat, TRANSLIT_MAP[lat]);
    }
  }
  return res;
}

export function transliterateToLatin(str: string): string {
  let res = str.toLowerCase();
  for (const cyr of SORTED_REVERSE_KEYS) {
    if (res.includes(cyr)) {
       res = res.replaceAll(cyr, REVERSE_TRANSLIT_MAP[cyr]);
    }
  }
  return res;
}

/**
 * Удаляет гласные (получение консонантного скелета)
 * "LiteFinance" -> "ltfnnc"
 */
export function getConsonantSkeleton(str: string): string {
  // Удаляем все гласные (en + ru) и спецсимволы
  return str.toLowerCase()
    .replace(/[aeiouyаеёиоуыэюя]/g, '')
    .replace(/[^a-zа-я0-9]/g, '');
}

/**
 * Агрессивная фонетическая нормализация
 */
export function normalizePhonetic(str: string): string {
  let normalized = str.toLowerCase();
  
  // Fix for English/Inglish
  if (normalized.startsWith('eng')) {
    normalized = 'ing' + normalized.slice(3);
  }

  normalized = normalized
    .replace(/0/g, 'o')
    .replace(/1/g, 'l')
    .replace(/3/g, 'z')
    .replace(/@/g, 'a')
    .replace(/\$/g, 's');

  normalized = normalized.replace(/([a-zа-я])\1+/g, '$1');
  
  normalized = normalized
    .replace(/ck/g, 'k')
    .replace(/c([eiy])/g, 's$1')
    .replace(/c/g, 'k')
    .replace(/q/g, 'k')
    .replace(/x/g, 'ks') // Galaxy -> Galaksi
    .replace(/w/g, 'v')
    .replace(/ph/g, 'f')
    .replace(/th/g, 'z')
    .replace(/tion/g, 'shon')
    .replace(/ough/g, 'of')
    .replace(/igh/g, 'i')
    .replace(/kn/g, 'n')
    .replace(/([bcdfghjklmnpqrstvwxz])e$/g, '$1') // Silent E
    .replace(/ee/g, 'i')
    .replace(/ea/g, 'i')
    .replace(/oo/g, 'u')
    .replace(/ai/g, 'i')
    .replace(/ay/g, 'i')
    .replace(/ei/g, 'i')
    .replace(/ey/g, 'i')
    .replace(/y$/g, 'i') // Galaxy -> Galaxi, Gelaksi -> Gelaksi
    .replace(/j/g, 'i');

  normalized = normalized
    .replace(/й/g, 'и')
    .replace(/ё/g, 'е')
    .replace(/э/g, 'е') // Гэлакси -> Гелакси
    .replace(/щ/g, 'ш')
    .replace(/ться/g, 'ца')
    .replace(/тся/g, 'ца')
    .replace(/стн/g, 'сн')
    .replace(/здн/g, 'зн')
    .replace(/ый$/g, 'и')
    .replace(/ий$/g, 'и');

  return normalized;
}

/**
 * Расстояние Дамерау-Левенштейна (учитывает перестановки соседних символов)
 * Оптимально для поиска опечаток (light <-> ligth)
 */
export function damerauLevenshteinDistance(source: string, target: string): number {
  const m = source.length;
  const n = target.length;
  
  const d: number[][] = [];
  for (let i = 0; i <= m; i++) d[i] = new Array(n + 1).fill(0);

  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = source[i - 1] === target[j - 1] ? 0 : 1;
      
      d[i][j] = Math.min(
        d[i - 1][j] + 1,      // deletion
        d[i][j - 1] + 1,      // insertion
        d[i - 1][j - 1] + cost // substitution
      );

      // Transposition check
      if (i > 1 && j > 1 && 
          source[i - 1] === target[j - 2] && 
          source[i - 2] === target[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  
  return d[m][n];
}

export const levenshteinDistance = damerauLevenshteinDistance;

/**
 * Генерирует варианты токена.
 * Возвращает объект, где variants - обычные варианты, skeletons - скелетные варианты.
 */
function generateTokenVariantsFull(token: string): { variants: Set<string>, skeletons: Set<string> } {
  const variants = new Set<string>();
  const skeletons = new Set<string>();
  
  if (!token) return { variants, skeletons };

  const lower = token.toLowerCase();
  variants.add(lower);
  variants.add(normalizePhonetic(lower));
  skeletons.add(getConsonantSkeleton(lower));
  
  const switched = switchKeyboardLayout(token).toLowerCase();
  variants.add(switched);
  variants.add(normalizePhonetic(switched));
  
  const isLatin = /^[a-z0-9]+$/.test(lower);
  const isCyrillic = /^[а-я0-9]+$/.test(lower);
  
  if (isLatin) {
    const cyr = transliterateToCyrillic(lower);
    variants.add(cyr);
    variants.add(normalizePhonetic(cyr));
  }
  
  if (isCyrillic) {
    const lat = transliterateToLatin(lower);
    variants.add(lat);
    variants.add(normalizePhonetic(lat));
    skeletons.add(getConsonantSkeleton(lat));
  }
  
  return { variants, skeletons };
}

// Для экспорта и совместимости
export function generateSearchVariants(str: string): string[] {
  const { variants, skeletons } = generateTokenVariantsFull(str);
  return [...Array.from(variants), ...Array.from(skeletons)];
}

function getTokenMatchScore(
  queryVariants: Set<string>, 
  querySkeletons: Set<string>,
  targetTokens: string[]
): number {
  let bestScore = 1000;

  // 1. Генерируем ОБЫЧНЫЕ варианты для Target (без скелетов)
  const targetNormal = targetTokens.flatMap(t => {
    const lower = t.toLowerCase();
    const phonetic = normalizePhonetic(lower);
    const vars = [lower];
    if (phonetic !== lower) vars.push(phonetic);
    return vars;
  });

  // 2. Генерируем СКЕЛЕТЫ для Target
  const targetSkeletons = targetTokens.map(t => getConsonantSkeleton(t)).filter(s => s.length > 1);

  // --- ПРОВЕРКА 1: Обычные варианты (Строгость + Fuzzy) ---
  for (const variant of queryVariants) {
    if (variant.length < 2) continue;

    for (const tCheck of targetNormal) {
      // Точное совпадение
      if (tCheck === variant) return 0;
      
      // Начало слова
      if (tCheck.startsWith(variant)) return 10;
      
      // Частичное вхождение
      if (tCheck.includes(variant)) return 20;

      // Fuzzy Logic (Damerau)
      let maxErrors = 0;
      if (variant.length >= 3) maxErrors = 1; 
      if (variant.length >= 7) maxErrors = 2; 
      if (variant.length >= 10) maxErrors = 3;

      // Prefix Fuzzy
      if (variant.length <= tCheck.length) {
        const prefix = tCheck.slice(0, variant.length);
        const dist = damerauLevenshteinDistance(variant, prefix);
        if (dist <= maxErrors) return 30 + dist;
      }

      // Substring Fuzzy (Strict)
      if (tCheck.length > variant.length) {
        const substringErrors = Math.max(0, maxErrors - 1);
        for (let i = 0; i <= tCheck.length - variant.length; i++) {
          const sub = tCheck.slice(i, i + variant.length);
          const dist = damerauLevenshteinDistance(variant, sub);
          if (dist <= substringErrors) return 40 + dist;
        }
      }
    }
  }

  // --- ПРОВЕРКА 2: Скелеты (ОЧЕНЬ СТРОГО - никаких includes!) ---
  for (const qSkel of querySkeletons) {
    if (qSkel.length < 2) continue;

    for (const tSkel of targetSkeletons) {
      // Точное совпадение скелетов (Аббревиатура)
      if (tSkel === qSkel) return 15; 

      // Начало скелета
      if (tSkel.startsWith(qSkel)) return 25; 
      
      // includes ЗАПРЕЩЕН для скелетов
    }
  }

  return bestScore;
}

function checkAcronym(query: string, targetTokens: string[]): boolean {
  const cleanQuery = query.replace(/[^a-zA-Zа-яА-Я0-9]/g, '').toLowerCase();
  if (cleanQuery.length < 2 || cleanQuery.length > 5) return false;
  if (targetTokens.length < cleanQuery.length) return false;

  let acronym = '';
  for (let i = 0; i < Math.min(targetTokens.length, cleanQuery.length); i++) {
    acronym += targetTokens[i][0] || '';
  }
  
  if (acronym.toLowerCase() === cleanQuery) return true;
  
  const { variants } = generateTokenVariantsFull(cleanQuery);
  for (const v of variants) {
     if (acronym.toLowerCase() === v) return true;
  }

  return false;
}

export function getMatchScore(query: string, target: string): number {
  if (!query || !query.trim()) return 0;
  if (!target) return 1000;

  const qTokens = query.split(/[\s,.-]+/).filter(s => s.length > 0);
  const targetSpaced = target.replace(/([a-z])([A-Z])/g, '$1 $2');
  const tTokens = targetSpaced.split(/[\s,.-]+/).filter(s => s.length > 0);

  if (qTokens.length === 0) return 0;

  const qRaw = query.toLowerCase().trim();
  const tRaw = target.toLowerCase();
  if (tRaw.includes(qRaw)) return 0;
  
  if (qTokens.length === 1 && checkAcronym(qTokens[0], tTokens)) {
    return 5;
  }

  let totalScore = 0;

  for (const qToken of qTokens) {
    const { variants, skeletons } = generateTokenVariantsFull(qToken);
    const tokenScore = getTokenMatchScore(variants, skeletons, tTokens);

    let combinedScore = 1000;
    if (tokenScore > 100) {
       const tCombined = [tRaw.replace(/\s/g, '')];
       combinedScore = getTokenMatchScore(variants, skeletons, tCombined);
    }

    const finalTokenScore = Math.min(tokenScore, combinedScore);

    if (finalTokenScore < 100) {
      totalScore += finalTokenScore;
    } else {
      return 1000; 
    }
  }

  const lengthPenalty = (tTokens.length - qTokens.length) * 1; 
  return (totalScore / qTokens.length) + Math.max(0, lengthPenalty);
}

export function smartSearch(query: string, target: string): boolean {
  return getMatchScore(query, target) < 100;
}

/** 
 * Разбивает поисковый запрос на токены (слова)
 * Используется для подсветки найденных слов в HighlightText
 */
export function getSearchTokens(query: string): string[] {
  if (!query || !query.trim()) return [];
  // Разбиваем по пробелам, запятым, точкам и дефисам
  return query.split(/[\s,.-]+/).filter(s => s.length > 0).map(t => t.toLowerCase());
}