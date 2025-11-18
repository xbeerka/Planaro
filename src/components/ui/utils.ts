type ClassValue = string | number | boolean | undefined | null | ClassValue[];

function clsx(...inputs: ClassValue[]): string {
  return inputs
    .flat()
    .filter((x) => typeof x === 'string')
    .join(' ')
    .trim();
}

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}
