import { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const BANCOS_BRASIL = [
  { codigo: '001', nome: 'Banco do Brasil' },
  { codigo: '003', nome: 'Banco da Amazônia (BASA)' },
  { codigo: '004', nome: 'Banco do Nordeste (BNB)' },
  { codigo: '010', nome: 'Credicoamo' },
  { codigo: '021', nome: 'Banestes' },
  { codigo: '025', nome: 'Banco Alfa' },
  { codigo: '033', nome: 'Santander' },
  { codigo: '036', nome: 'Banco Bradesco BBI' },
  { codigo: '037', nome: 'Banco do Estado do Pará (BANPARÁ)' },
  { codigo: '041', nome: 'Banrisul' },
  { codigo: '047', nome: 'Banco do Estado de Sergipe (Banese)' },
  { codigo: '070', nome: 'Banco de Brasília (BRB)' },
  { codigo: '077', nome: 'Banco Inter' },
  { codigo: '084', nome: 'Uniprime Norte do Paraná' },
  { codigo: '085', nome: 'Cooperativa Central Ailos' },
  { codigo: '104', nome: 'Caixa Econômica Federal' },
  { codigo: '136', nome: 'Unicred' },
  { codigo: '197', nome: 'Stone Pagamentos' },
  { codigo: '208', nome: 'BTG Pactual' },
  { codigo: '212', nome: 'Banco Original' },
  { codigo: '237', nome: 'Bradesco' },
  { codigo: '246', nome: 'Banco ABC Brasil' },
  { codigo: '260', nome: 'Nubank (Nu Pagamentos)' },
  { codigo: '290', nome: 'PagSeguro (PagBank)' },
  { codigo: '318', nome: 'Banco BMG' },
  { codigo: '320', nome: 'Banco CCB Brasil' },
  { codigo: '336', nome: 'Banco C6' },
  { codigo: '341', nome: 'Itaú Unibanco' },
  { codigo: '376', nome: 'Banco J.P. Morgan' },
  { codigo: '389', nome: 'Banco Mercantil do Brasil' },
  { codigo: '399', nome: 'HSBC' },
  { codigo: '422', nome: 'Safra' },
  { codigo: '600', nome: 'Banco Luso Brasileiro' },
  { codigo: '633', nome: 'Banco Rendimento' },
  { codigo: '655', nome: 'Banco Votorantim' },
  { codigo: '707', nome: 'Daycoval' },
  { codigo: '741', nome: 'Banco Ribeirão Preto' },
  { codigo: '745', nome: 'Citibank' },
  { codigo: '748', nome: 'Sicredi' },
  { codigo: '756', nome: 'Sicoob' },
];

interface BancoSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export default function BancoSelector({ value, onChange }: BancoSelectorProps) {
  const [open, setOpen] = useState(false);

  const selectedLabel = BANCOS_BRASIL.find(b =>
    `${b.codigo} - ${b.nome}` === value || b.nome === value
  )?.nome;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className="truncate">
            {value || 'Selecione o banco...'}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar banco..." />
          <CommandList>
            <CommandEmpty>Banco não encontrado.</CommandEmpty>
            <CommandGroup>
              {BANCOS_BRASIL.map((banco) => {
                const label = `${banco.codigo} - ${banco.nome}`;
                return (
                  <CommandItem
                    key={banco.codigo}
                    value={label}
                    onSelect={() => {
                      onChange(label);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === label ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    {label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
