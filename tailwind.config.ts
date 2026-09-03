import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
        brand: ["Cinzel", "Georgia", "serif"],
      },
      /**
       * Escala tipográfica — REBRAND, fatia 2.
       *
       * Cada degrau agora corresponde a um papel real do protótipo, e não a
       * uma progressão abstrata. A densidade é o que dá a cara de sistema de
       * gestão: o protótipo trabalha o corpo entre 11,5px e 13,5px, onde o app
       * usava 14px e 16px.
       *
       *   xs   11,5px  meta, badge, timestamp        (o mais usado: 5.570 vezes)
       *   sm   12,5px  corpo secundário, UI densa    (o mais usado no protótipo)
       *   base 13,5px  botão, campo, texto de leitura
       *   lg   15px    título de cartão
       *   xl   17px    título de modal e de estado vazio
       *   2xl  22px    KPI médio, h1 de módulo secundário
       *   3xl  26px    h1 de página
       *   4xl  30px    KPI de destaque
       *
       * Disciplina de uso preservada: xs SÓ para metadados; sm para UI densa;
       * texto de leitura começa em base.
       *
       * O entrelinha aperta junto com o corpo — número grande fica em 1,1 a 1,2
       * e prosa em 1,5 a 1,55, como no protótipo. E o espacejamento fica
       * negativo só nos corpos grandes, que é onde ele lá aparece (−0,3px no
       * h1 de 26px).
       */
      fontSize: {
        xs: ["0.71875rem", { lineHeight: "1.0625rem", letterSpacing: "0.01em" }],
        sm: ["0.78125rem", { lineHeight: "1.1875rem" }],
        base: ["0.84375rem", { lineHeight: "1.3125rem" }],
        lg: ["0.9375rem", { lineHeight: "1.375rem" }],
        xl: ["1.0625rem", { lineHeight: "1.5rem", letterSpacing: "-0.008em" }],
        "2xl": ["1.375rem", { lineHeight: "1.8125rem", letterSpacing: "-0.009em" }],
        "3xl": ["1.625rem", { lineHeight: "1.9375rem", letterSpacing: "-0.012em" }],
        "4xl": ["1.875rem", { lineHeight: "2.0625rem", letterSpacing: "-0.015em" }],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          tint: "hsl(var(--primary-tint))",
        },
        // Navy da marca, em três passos. É a cor predominante do rebrand:
        // header, splash e véu do login são todos ela.
        navy: {
          DEFAULT: "hsl(var(--navy))",
          hover: "hsl(var(--navy-hover))",
          tint: "hsl(var(--navy-tint))",
        },
        // Dourado da marca. Assinatura, não cor de interface — no painel do
        // protótipo ele aparece só na logo. Usar com parcimônia.
        gold: {
          DEFAULT: "hsl(var(--gold))",
          deep: "hsl(var(--gold-deep))",
          hi: "hsl(var(--gold-hi))",
          logo: "hsl(var(--logo-accent))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        // Os três estados ganharam o trio do protótipo — fundo tingido
        // (`tint`), texto legível sobre ele (`ink`) e borda (`line`). Substitui
        // a composição de alfa na mão (`bg-warning/10 text-warning`), que muda
        // de contraste conforme a superfície embaixo.
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
          tint: "hsl(var(--destructive-tint))",
          ink: "hsl(var(--destructive-ink))",
          line: "hsl(var(--destructive-line))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
          tint: "hsl(var(--success-tint))",
          ink: "hsl(var(--success-ink))",
          line: "hsl(var(--success-line))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
          tint: "hsl(var(--warning-tint))",
          ink: "hsl(var(--warning-ink))",
          line: "hsl(var(--warning-line))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
        },
        // Séries de gráfico — única exceção aprovada à regra "cor só para
        // estado". Definidas aqui para matar os hsl() duplicados nos charts.
        chart: {
          1: "hsl(var(--chart-1))",
          2: "hsl(var(--chart-2))",
          3: "hsl(var(--chart-3))",
          4: "hsl(var(--chart-4))",
          5: "hsl(var(--chart-5))",
          6: "hsl(var(--chart-6))",
          7: "hsl(var(--chart-7))",
          8: "hsl(var(--chart-8))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        nav: {
          DEFAULT: "hsl(var(--nav-bg))",
          foreground: "hsl(var(--nav-fg))",
          active: "hsl(var(--nav-active))",
          hover: "hsl(var(--nav-hover))",
          border: "hsl(var(--nav-border))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      /**
       * Sombra e gradiente NÃO existiam aqui — e por isso os tokens
       * `--shadow-*` e `--gradient-*` do `index.css` quase não chegavam à
       * tela: `shadow-sm`/`shadow-md`/`shadow-lg` em card.tsx, .stat-card e
       * .glass-card eram as sombras DEFAULT do Tailwind, não as nossas.
       * Mapeando aqui, trocar o token passa a repintar de verdade — e a
       * sombra ganha override no escuro, onde a antiga (navy sobre fundo
       * escuro) simplesmente não aparecia.
       */
      boxShadow: {
        sm: "var(--shadow-sm)",
        DEFAULT: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        xl: "var(--shadow-xl)",
        glow: "var(--shadow-glow)",
        "glow-sm": "var(--shadow-glow-sm)",
      },
      backgroundImage: {
        "gradient-primary": "var(--gradient-primary)",
        "gradient-hero": "var(--gradient-hero)",
        "gradient-card": "var(--gradient-card)",
        "gradient-dark": "var(--gradient-dark)",
        "gradient-accent-subtle": "var(--gradient-accent-subtle)",
        "gradient-warm": "var(--gradient-warm)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-left": {
          from: { opacity: "0", transform: "translateX(-12px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 0 0 hsl(var(--accent) / 0.3)" },
          "50%": { boxShadow: "0 0 20px 4px hsl(var(--accent) / 0.15)" },
        },
        "count-up": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.4s ease-out forwards",
        "slide-in-left": "slide-in-left 0.3s ease-out forwards",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        "count-up": "count-up 0.5s ease-out forwards",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
