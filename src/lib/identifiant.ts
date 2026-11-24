// Supabase Auth exige un email : l'app n'utilisant qu'un nom d'utilisateur,
// on le fait correspondre à un email synthétique interne, jamais montré.
export function usernameToEmail(username: string) {
  return `${username.trim().toLowerCase()}@transfert.local`;
}

export const IDENTIFIANT_VALIDE = /^[a-z0-9][a-z0-9._-]{1,29}$/;
export const MOT_DE_PASSE_MIN = 8;
