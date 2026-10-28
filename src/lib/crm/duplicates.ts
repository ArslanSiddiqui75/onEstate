interface Reachable {
  email?: string;
  phone?: string;
  phones?: { number: string }[];
}

function digits(value: string) {
  return value.replace(/\D/g, "");
}

function phoneKeys(person: Reachable) {
  const numbers = [person.phone || "", ...(person.phones || []).map((item) => item.number)];
  return new Set(numbers.map(digits).filter((value) => value.length >= 7));
}

/** The first lead that shares an email or a phone number with the person being added. */
export function findDuplicateLead<T extends Reachable>(leads: T[], candidate: Reachable): T | undefined {
  const email = candidate.email?.trim().toLowerCase();
  const keys = phoneKeys(candidate);
  return leads.find((lead) => {
    const other = lead.email?.trim().toLowerCase();
    if (email && other && email === other) return true;
    if (!keys.size) return false;
    for (const key of phoneKeys(lead)) {
      if (keys.has(key)) return true;
    }
    return false;
  });
}
