-- Guarda a senha do certificado A1, cifrada.
--
-- A `upload-certificado` EXIGIA a senha no formulário, validava que veio e
-- depois a descartava. Ninguém percebeu porque o arquivo subia normalmente e a
-- tela dizia "Certificado enviado com sucesso" — mas a senha é o que abre o
-- .pfx, e sem ela o `pk12util` não instala o certificado no navegador do
-- agente. O certificado ficava no Storage, íntegro e inútil.
--
-- Cifrada com a mesma autoridade das senhas de portal
-- (`_shared/credenciais-cifra.ts`, AES-GCM + CREDENCIAIS_ENCRYPTION_KEY), e não
-- com a service role: rotacionar a chave de infraestrutura não pode tornar
-- certificado nenhum indecifrável.

ALTER TABLE public.cert_upload_tokens
  ADD COLUMN IF NOT EXISTS senha_cifrada text;

COMMENT ON COLUMN public.cert_upload_tokens.senha_cifrada IS
  'Senha do .pfx cifrada em AES-GCM (formato v2:iv:ciphertext) por _shared/credenciais-cifra.ts. Necessária para o agente instalar o certificado na base NSS do Chrome.';

-- Quando o certificado foi efetivamente instalado no agente — não é o mesmo que
-- ter sido enviado. Separar os dois é o que impede a tela de ficar verde só
-- porque o arquivo chegou ao Storage.
ALTER TABLE public.cert_upload_tokens
  ADD COLUMN IF NOT EXISTS instalado_no_agente_em timestamptz;

COMMENT ON COLUMN public.cert_upload_tokens.instalado_no_agente_em IS
  'Momento em que o agente confirmou a instalação (base NSS + policy). NULL = o arquivo subiu mas o robô ainda não consegue apresentá-lo.';
