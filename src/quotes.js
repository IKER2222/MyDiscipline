// ═══════════════════════════════════════════════════════════
// Motivational Quotes Database
// ═══════════════════════════════════════════════════════════

const quotes = [
  { text: "La disciplina es el puente entre tus metas y tus logros.", author: "Jim Rohn" },
  { text: "No cuentes los días, haz que los días cuenten.", author: "Muhammad Ali" },
  { text: "El éxito es la suma de pequeños esfuerzos repetidos día tras día.", author: "Robert Collier" },
  { text: "Somos lo que hacemos repetidamente. La excelencia, entonces, no es un acto, sino un hábito.", author: "Aristóteles" },
  { text: "La única forma de hacer un gran trabajo es amar lo que haces.", author: "Steve Jobs" },
  { text: "La motivación te pone en marcha, el hábito te mantiene en movimiento.", author: "Jim Ryun" },
  { text: "Cada mañana tienes dos opciones: seguir durmiendo con tus sueños, o levantarte y perseguirlos.", author: "Carmelo Anthony" },
  { text: "El dolor de la disciplina pesa gramos, el dolor del arrepentimiento pesa toneladas.", author: "Jim Rohn" },
  { text: "Tu cuerpo puede hacer casi cualquier cosa. Es tu mente la que necesitas convencer.", author: "Anónimo" },
  { text: "Un viaje de mil millas comienza con un solo paso.", author: "Lao Tse" },
  { text: "Actúa como si lo que haces marca la diferencia. Lo hace.", author: "William James" },
  { text: "La constancia es la virtud por la que todas las demás virtudes dan fruto.", author: "Arturo Graf" },
  { text: "Haz hoy lo que otros no quieren, para que mañana puedas hacer lo que otros no pueden.", author: "Jerry Rice" },
  { text: "El secreto de progresar es empezar.", author: "Mark Twain" },
  { text: "La fuerza no viene de la capacidad física, sino de una voluntad indomable.", author: "Mahatma Gandhi" },
  { text: "Si no puedes volar, corre. Si no puedes correr, camina. Si no puedes caminar, gatea, pero sigue adelante.", author: "Martin Luther King Jr." },
  { text: "Primero formamos nuestros hábitos, luego nuestros hábitos nos forman a nosotros.", author: "John Dryden" },
  { text: "El que tiene un porqué para vivir, puede soportar casi cualquier cómo.", author: "Friedrich Nietzsche" },
  { text: "No importa lo lento que vayas mientras no te detengas.", author: "Confucio" },
  { text: "La mejor preparación para mañana es hacer lo mejor hoy.", author: "H. Jackson Brown Jr." },
];

/**
 * Get a random motivational quote
 * @returns {{ text: string, author: string }}
 */
export function getRandomQuote() {
  return quotes[Math.floor(Math.random() * quotes.length)];
}

/**
 * Get today's quote (deterministic based on date)
 * @returns {{ text: string, author: string }}
 */
export function getDailyQuote() {
  const today = new Date();
  const dayOfYear = Math.floor(
    (today - new Date(today.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24)
  );
  return quotes[dayOfYear % quotes.length];
}
