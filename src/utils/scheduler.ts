import { Department, Resource, SchedulerEvent, Month } from '../types/scheduler';

export const WEEKS = 52;
export const UNITS = 4;

// Sort resources by grade (descending), users without grade go to the end
export function sortResourcesByGrade(resources: Resource[]): Resource[] {
  return [...resources].sort((a, b) => {
    // Users without grade go to the end
    if (!a.grade && !b.grade) return 0;
    if (!a.grade) return 1;
    if (!b.grade) return -1;
    // Sort by grade ID descending (higher grade first)
    return Number(b.grade) - Number(a.grade);
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

export function weekLabel(weekIndex: number, year: number): string {
  const scheduleStartDate = getScheduleYearStart(year);
  const start = addDays(scheduleStartDate, weekIndex * 7);
  const end = addDays(start, 6);
  return `${formatDate(start)} – ${formatDate(end)}`;
}

export function getCurrentWeekIndex(year: number): number {
  const now = new Date();
  const scheduleStartDate = getScheduleYearStart(year);
  const diff = getDaysDifference(now, scheduleStartDate);
  return Math.max(0, Math.min(WEEKS - 1, Math.floor(diff / 7)));
}

export function generateMonths(year: number): Month[] {
  const monthNames = [
    "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
    "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
  ];
  
  const scheduleStart = getScheduleYearStart(year);
  
  // Инициализируем счетчики недель для каждого месяца
  const monthWeekCounts = new Array(12).fill(0);
  
  // Проходим по всем 52 неделям и определяем к какому месяцу относится каждая неделя
  // Неделя относится к месяцу, если её понедельник (начало) приходится на этот месяц
  for (let week = 0; week < WEEKS; week++) {
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
        firstName,
        lastName,
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