import { Department, Resource, SchedulerEvent, Month, Grade } from '../types/scheduler';

// DEPRECATED: Use getWeeksInYear(year) instead for dynamic calculation
export const WEEKS = 52;
export const UNITS = 4;

/**
 * Вычисляет количество недель в году по стандарту ISO 8601
 * @param year - Год
 * @returns 52 или 53 недели
 * 
 * По ISO 8601 год имеет 53 недели если:
 * - Начинается с четверга (Thu) ИЛИ
 * - Високосный год И начинается со среды (Wed)
 */
export function getWeeksInYear(year: number): number {
  const jan1 = new Date(year, 0, 1);
  const jan1Day = jan1.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const jan1DayISO = jan1Day === 0 ? 7 : jan1Day; // Convert to ISO: 1=Mon, 7=Sun
  
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  
  // Год имеет 53 недели если:
  // - Начинается с четверга (4) ИЛИ
  // - Високосный год И начинается со среды (3)
  if (jan1DayISO === 4 || (isLeap && jan1DayISO === 3)) {
    return 53;
  }
  
  return 52;
}

// Sort resources by grade (using sort_order from settings), users without grade go to the end
export function sortResourcesByGrade(resources: Resource[], grades: Grade[] = []): Resource[] {
  // Create a map for fast lookup of sort_order by grade ID or Name
  // sort_order is ascending (0 = top, 1 = second, etc.)
  const gradeOrderMap = new Map<string, number>();
  grades.forEach(g => {
    gradeOrderMap.set(String(g.id), g.sort_order);
    if (g.name) {
      gradeOrderMap.set(g.name, g.sort_order); // Fallback for resources with only grade name
    }
  });

  return [...resources].sort((a, b) => {
    const gradeA = a.gradeId || a.grade;
    const gradeB = b.gradeId || b.grade;

    // Users without grade go to the end
    if (!gradeA && !gradeB) return 0;
    if (!gradeA) return 1;
    if (!gradeB) return -1;

    // Get sort order (default to 9999 if not found)
    const orderA = gradeOrderMap.get(String(gradeA)) ?? 9999;
    const orderB = gradeOrderMap.get(String(gradeB)) ?? 9999;

    // Sort ascending (lower sort_order first)
    return orderA - orderB;
  });
}

function formatDate(date: Date): string {
  const day = date.getDate();
  const monthNames = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  const month = monthNames[date.getMonth()];
  return `${day} ${month}`;
}

function getStartOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function getDaysDifference(date1: Date, date2: Date): number {
  const d1 = getStartOfDay(date1);
  const d2 = getStartOfDay(date2);
  return Math.floor((d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24));
}

export function getScheduleYearStart(year: number): Date {
  const jan1 = new Date(year, 0, 1);
  const dayOfWeek = jan1.getDay();
  const shift = (dayOfWeek + 6) % 7;
  return addDays(jan1, -shift);
}

export function getWeekStartDate(year: number, weekIndex: number): Date {
  const start = getScheduleYearStart(year);
  return addDays(start, weekIndex * 7);
}

export function getWeekIndexFromDate(date: Date, year: number): number {
  const start = getScheduleYearStart(year);
  const diff = getDaysDifference(date, start);
  return Math.floor(diff / 7);
}

export function weekLabel(weekIndex: number, year: number, weekWidth?: number): string {
  const scheduleStartDate = getScheduleYearStart(year);
  const start = addDays(scheduleStartDate, weekIndex * 7);
  const end = addDays(start, 6);
  
  // Очень компактный формат для XS (только цифры)
  if (weekWidth !== undefined && weekWidth <= 72) {
    const startDay = start.getDate();
    const endDay = end.getDate();
    return `${startDay}–${endDay}`;
  }
  
  // Компактный формат для S (цифры + месяц)
  if (weekWidth !== undefined && weekWidth <= 120) {
    const startDay = start.getDate();
    const endDay = end.getDate();
    const monthNames = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
    const endMonth = monthNames[end.getMonth()];
    return `${startDay} – ${endDay} ${endMonth}`;
  }
  
  return `${formatDate(start)} – ${formatDate(end)}`;
}

export function getCurrentWeekIndex(year: number): number {
  const now = new Date();
  const scheduleStartDate = getScheduleYearStart(year);
  const diff = getDaysDifference(now, scheduleStartDate);
  const weeksInYear = getWeeksInYear(year);
  return Math.max(0, Math.min(weeksInYear - 1, Math.floor(diff / 7)));
}

export function generateMonths(year: number): Month[] {
  const monthNames = [
    "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
    "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
  ];
  
  const scheduleStart = getScheduleYearStart(year);
  const weeksInYear = getWeeksInYear(year);
  
  // Инициализируем счетчики недель для каждого месяца
  const monthWeekCounts = new Array(12).fill(0);
  
  // Проходим по всем неделям года (52 или 53) и определяем к какому месяцу относится каждая неделя
  // Неделя относится к месяцу, если её понедельник (начало) приходится на этот месяц
  for (let week = 0; week < weeksInYear; week++) {
    const weekStartDate = addDays(scheduleStart, week * 7);
    const monthIndex = weekStartDate.getMonth();
    
    // Если это не тот год (возможно первые дни января относятся к декабрю прошлого года)
    if (weekStartDate.getFullYear() === year) {
      monthWeekCounts[monthIndex]++;
    } else if (weekStartDate.getFullYear() === year + 1) {
      // Последние недели декабря могут захватить январь следующего года - относим к декабрю
      monthWeekCounts[11]++;
    } else {
      // Первые недели могут начинаться в декабре предыдущего года - относим к январю
      monthWeekCounts[0]++;
    }
  }
  
  // Создаем массив месяцев
  const months: Month[] = monthNames.map((name, index) => ({
    name,
    weeks: monthWeekCounts[index]
  }));
  
  return months;
}

export function generateUsers(departments: Department[]): Resource[] {
  const firstNames = [
    'Алексей', 'Мария', 'Иван', 'Ольга', 'Сергей', 'Анна', 'Дмитрий', 'Елена', 'Михаил', 'Екатерина',
    'Андрей', 'Наталья', 'Павел', 'Юлия', 'Артем', 'Светлана', 'Владимир', 'Алина', 'Роман', 'Татьяна',
    'Константин', 'Ирина', 'Никита', 'Марина', 'Александр', 'Виктория', 'Евгений', 'Ксения', 'Максим', 'Оксана'
  ];
  const lastNames = [
    'Иванов', 'Петров', 'Сидоров', 'Смирнов', 'Кузнецов', 'Попов', 'Васильев', 'Соколов', 'Михайлов', 'Новиков',
    'Федоров', 'Морозов', 'Волков', 'Алексеев', 'Лебедев', 'Семенов', 'Егоров', 'Павлов', 'Козлов', 'Степанов',
    'Николаев', 'Орлов', 'Андреев', 'Макаров', 'Никитин', 'Захаров', 'Зайцев', 'Соловьев', 'Борисов', 'Яковлев'
  ];
  const positions: Record<string, string[]> = {
    d1: [
      'Frontend разработчик', 'Backend разработчик', 'Fullstack разработчик', 'DevOps инженер', 'Data Scientist',
      'Mobile разработчик', 'QA инженер', 'Team Lead', 'Architect', 'Tech Lead'
    ],
    d2: [
      'UI/UX дизайнер', 'Графический дизайнер', 'Веб-дизайнер', 'Product дизайнер', 'Motion дизайнер',
      'Иллюстратор', 'Арт-директор', 'UX исследователь', 'Дизайнер интерфейсов', 'Креативный директор'
    ],
    d3: [
      'Маркетолог', 'SMM специалист', 'Контент-менеджер', 'SEO специалист', 'PPC менеджер',
      'Аналитик', 'PR менеджер', 'Бренд-менеджер', 'Копирайтер', 'Менеджер по трафику'
    ]
  };

  const resources: Resource[] = [];
  let idCounter = 1;

  departments.forEach(dept => {
    const deptPositions = positions[dept.id] || positions['d1'];
    const usedNames = new Set<string>();

    for (let i = 0; i < 10; i++) {
      let firstName: string, lastName: string, fullName: string;
      do {
        firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
        lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
        fullName = `${firstName} ${lastName}`;
      } while (usedNames.has(fullName));

      usedNames.add(fullName);
      const position = deptPositions[Math.floor(Math.random() * deptPositions.length)];

      resources.push({
        id: `r${idCounter++}`,
        fullName,
        position,
        departmentId: dept.id
      });
    }
  });

  return resources;
}

export function getLastWeeksOfMonths(months: Month[]): Set<number> {
  const lastWeeks = new Set<number>();
  let currentWeek = 0;
  months.forEach(month => {
    currentWeek += month.weeks;
    lastWeeks.add(currentWeek - 1);
  });
  return lastWeeks;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function sortEvents(
  events: SchedulerEvent[],
  resources: Resource[]
): SchedulerEvent[] {
  const getResourceIndex = (id: string) => resources.findIndex(r => r.id === id);

  return [...events].sort((a, b) => {
    const ra = getResourceIndex(a.resourceId);
    const rb = getResourceIndex(b.resourceId);
    if (ra !== rb) return ra - rb;
    if (a.startWeek !== b.startWeek) return a.startWeek - b.startWeek;
    return a.unitStart - b.unitStart;
  });
}