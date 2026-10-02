import { useState } from 'react';
import { Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  aplicarPisoEmMassa,
  resumoDoPisoEmMassa,
  tetoDoPercentual,
  type BaseDoPiso,
  type ItemParaPiso,
} from '@/lib/robo/piso-em-massa';

/**
 * Preencher o piso de MUITOS itens de uma vez.
 *
 * Vem da auditoria de 02/10/2026: o robô existe para a pessoa não repetir a
 * mesma operação 182 vezes — e, para ligá-lo, era preciso digitar 182 pisos,
 * um por linha. Os itens já entravam em massa (importados do processo); o piso,
 * não.
 *
 * O cálculo e os cuidados vivem em `lib/robo/piso-em-massa.ts`, testados à
 * parte: aqui só há a escolha e o resultado na tela, para conferir item a item
 * antes de salvar. Nada é gravado por este componente — ele devolve a lista
 * nova a quem o chamou.
 */
export default function PisoEmMassa({
  itens,
  aoAplicar,
  temCusto,
}: {
  itens: ItemParaPiso[];
  aoAplicar: (itens: ItemParaPiso[], resumo: string) => void;
  /** Se algum item tem custo da Precificação; sem isso, a base "custo" não se oferece. */
  temCusto: boolean;
}) {
  const [base, setBase] = useState<BaseDoPiso>('valor');
  const [percentual, setPercentual] = useState('');
  const [somenteVazios, setSomenteVazios] = useState(true);

  const teto = tetoDoPercentual(base);
  const pct = Number(percentual.replace(',', '.'));
  const valido = Number.isFinite(pct) && pct > 0 && pct <= teto;
  const semPiso = itens.filter((i) => i.valorMinimo === null || i.valorMinimo === undefined).length;

  const aplicar = () => {
    const regra = { base, percentual: pct, somenteVazios };
    const r = aplicarPisoEmMassa(itens, regra);
    aoAplicar(r.itens, resumoDoPisoEmMassa(r, regra));
  };

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-muted px-3 py-2">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          <Calculator className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
          Piso de todos os itens
        </div>

        <div className="flex items-end gap-1.5">
          <div>
            <Label htmlFor="piso-massa-pct" className="text-xs text-muted-foreground">
              Percentual
            </Label>
            <Input
              id="piso-massa-pct"
              inputMode="decimal"
              value={percentual}
              onChange={(e) => setPercentual(e.target.value.replace(/[^\d.,]/g, ''))}
              placeholder="ex.: 85"
              className="mt-1 w-24 tabular-nums"
            />
          </div>
          <span className="pb-2 text-sm text-muted-foreground">% do</span>
          <div>
            <Label htmlFor="piso-massa-base" className="sr-only">
              Base do cálculo
            </Label>
            <Select value={base} onValueChange={(v) => setBase(v as BaseDoPiso)}>
              <SelectTrigger id="piso-massa-base" className="mt-1 w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="valor">valor unitário</SelectItem>
                <SelectItem value="custo" disabled={!temCusto}>
                  custo unitário
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-2 pb-2">
          <Switch id="piso-massa-vazios" checked={somenteVazios} onCheckedChange={setSomenteVazios} />
          <Label htmlFor="piso-massa-vazios" className="text-sm font-normal text-muted-foreground">
            só os {semPiso} sem piso
          </Label>
        </div>

        <Button type="button" variant="outline" size="sm" className="mb-1" disabled={!valido} onClick={aplicar}>
          Aplicar
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        {base === 'custo'
          ? 'O piso nasce do custo da Precificação — acima de 100% é o normal: 110% é “custo mais 10%”.'
          : 'O piso nasce do valor unitário de cada item. Acima de 100% o robô não teria como lançar.'}{' '}
        Item sem {base === 'custo' ? 'custo' : 'valor'} cadastrado fica <strong>sem piso</strong>, e o robô não
        dá lance nele — a conta dirá quais.
        {!somenteVazios && ' Atenção: os pisos já preenchidos serão substituídos.'}
      </p>
    </div>
  );
}
