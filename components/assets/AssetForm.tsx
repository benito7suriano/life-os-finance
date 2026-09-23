'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui'
import type { AssetCategory, AssetDetail, AssetOwner, AssetWriteInput } from '@/lib/assets/types'

const categories: Array<{ value: AssetCategory; label: string }> = [
  { value: 'real_estate', label: 'Real Estate' }, { value: 'vehicle', label: 'Vehicle' },
  { value: 'private_investment', label: 'Private Investment' }, { value: 'retirement', label: 'Retirement' },
]
const label: CSSProperties = { display: 'block', marginBottom: 6, fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--fg3)' }
const control: CSSProperties = { width: '100%', height: 42, borderRadius: 10, padding: '0 12px', background: 'rgba(255,255,255,.04)', border: '1px solid var(--card-border)', color: 'var(--fg)', fontSize: 13, outline: 'none', colorScheme: 'dark' }

function Field({ name, title, type = 'text', value, onChange, required }: { name: string; title: string; type?: string; value: unknown; onChange: (key: string, value: string | number | boolean) => void; required?: boolean }) {
  return <div><label style={label} htmlFor={name}>{title}</label><input id={name} type={type} value={(value as string | number) ?? ''} required={required} min={type === 'number' ? 0 : undefined} step={type === 'number' ? 'any' : undefined} style={control} onChange={(event) => onChange(name, type === 'number' ? (event.target.value === '' ? '' : Number(event.target.value)) : event.target.value)} /></div>
}

export function AssetForm({ open, asset, owners, onClose, onSave, onCreateOwner }: {
  open: boolean; asset?: AssetDetail; owners: AssetOwner[]; onClose: () => void
  onSave: (input: AssetWriteInput | Partial<AssetWriteInput>) => Promise<void>
  onCreateOwner: (name: string) => Promise<AssetOwner>
}) {
  const [category, setCategory] = useState<AssetCategory>('real_estate')
  const [base, setBase] = useState<Record<string, string | number>>({ name: '', currency: 'USD', currentValue: 0, notes: '' })
  const [details, setDetails] = useState<Record<string, string | number | boolean>>({})
  const [allocations, setAllocations] = useState<Array<{ ownerId: string; percentage: number }>>([])
  const [newOwner, setNewOwner] = useState('')
  const [localOwners, setLocalOwners] = useState(owners)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => setLocalOwners(owners), [owners])
  useEffect(() => {
    if (!open) return
    setCategory(asset?.category || 'real_estate')
    setBase({ name: asset?.name || '', currency: asset?.currency || 'USD', currentValue: asset?.currentValue ?? 0, notes: asset?.notes || '' })
    setDetails(asset ? { ...asset.details } : { primaryResidence: false })
    setAllocations(asset?.owners.map(({ ownerId, percentage }) => ({ ownerId, percentage })) || (owners[0] ? [{ ownerId: owners[0].id, percentage: 100 }] : []))
    setError('')
  }, [open, asset, owners])

  const total = useMemo(() => allocations.reduce((sum, item) => sum + Number(item.percentage || 0), 0), [allocations])
  if (!open) return null
  const setDetail = (key: string, value: string | number | boolean) => setDetails((current) => ({ ...current, [key]: value }))

  async function addOwner() {
    if (!newOwner.trim()) return
    try {
      const owner = await onCreateOwner(newOwner.trim())
      setLocalOwners((current) => [...current, owner])
      setAllocations((current) => [...current, { ownerId: owner.id, percentage: current.length ? 0 : 100 }])
      setNewOwner('')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to add owner') }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (Math.abs(total - 100) > .001 || allocations.length === 0) return setError('Ownership allocations must total 100%')
    setSaving(true); setError('')
    try {
      const input: AssetWriteInput = {
        name: String(base.name).trim(), category, currency: String(base.currency), notes: String(base.notes || ''),
        currentValue: Number(base.currentValue), owners: allocations, details: { ...details, category } as AssetWriteInput['details'],
      }
      if (asset) {
        await onSave({ name: input.name, notes: input.notes, owners: input.owners, details: input.details })
      } else await onSave(input)
      onClose()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to save asset') }
    finally { setSaving(false) }
  }

  return <>
    <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />
    <aside className="fixed inset-0 z-50 ml-auto flex w-full flex-col bg-bg2 md:left-auto md:max-w-2xl md:border-l md:border-card">
      <header className="flex items-center justify-between border-b border-card px-5 py-4 md:px-7">
        <div><p className="font-mono text-[9px] uppercase tracking-[.16em] text-accent">Asset register</p><h2 className="mt-1 font-display text-lg font-semibold">{asset ? `Edit ${asset.name}` : 'New asset'}</h2></div>
        <button onClick={onClose} aria-label="Close" className="rounded-lg bg-white/[.04] p-2 text-fg3"><X size={19} /></button>
      </header>
      <form onSubmit={submit} className="flex-1 overflow-y-auto">
        <div className="space-y-7 p-5 md:p-7">
          <section className="grid gap-4 md:grid-cols-2">
            <Field name="name" title="Name" value={base.name} required onChange={(key, value) => setBase((current) => ({ ...current, [key]: value as string | number }))} />
            <div><label style={label} htmlFor="asset-category">Category</label><select id="asset-category" value={category} disabled={Boolean(asset)} onChange={(e) => { setCategory(e.target.value as AssetCategory); setDetails(e.target.value === 'real_estate' ? { primaryResidence: false } : {}) }} style={{ ...control, opacity: asset ? .55 : 1 }}>{categories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
            <div><label style={label} htmlFor="asset-currency">Currency</label><select id="asset-currency" value={base.currency} disabled={Boolean(asset)} onChange={(e) => setBase((current) => ({ ...current, currency: e.target.value }))} style={{ ...control, opacity: asset ? .55 : 1 }}><option>USD</option><option>DOP</option></select></div>
            {!asset && <Field name="currentValue" title="Opening current value" type="number" value={base.currentValue} required onChange={(key, value) => setBase((current) => ({ ...current, [key]: value as string | number }))} />}
          </section>

          <section><h3 className="mb-4 font-display text-sm font-semibold text-fg">{categories.find((item) => item.value === category)?.label} details</h3>
            <div className="grid gap-4 md:grid-cols-2">
              {category === 'real_estate' && <><Field name="propertyType" title="Property type" value={details.propertyType} onChange={setDetail}/><label className="flex items-center gap-3 self-end rounded-xl border border-card px-3 py-3 text-sm text-fg2"><input type="checkbox" checked={Boolean(details.primaryResidence)} onChange={(e) => setDetail('primaryResidence', e.target.checked)} /> Primary residence</label><Field name="purchasePrice" title="Purchase price" type="number" value={details.purchasePrice} onChange={setDetail}/><Field name="purchaseDate" title="Purchase date" type="date" value={details.purchaseDate} onChange={setDetail}/><Field name="street" title="Street address" value={details.street} onChange={setDetail}/><Field name="city" title="City" value={details.city} onChange={setDetail}/><Field name="stateProvince" title="State / province" value={details.stateProvince} onChange={setDetail}/><Field name="postalCode" title="Postal code" value={details.postalCode} onChange={setDetail}/><Field name="country" title="Country" value={details.country} onChange={setDetail}/></>}
              {category === 'vehicle' && <><Field name="vin" title="VIN" value={details.vin} onChange={setDetail}/><Field name="make" title="Make" value={details.make} onChange={setDetail}/><Field name="model" title="Model" value={details.model} onChange={setDetail}/><Field name="year" title="Year" type="number" value={details.year} onChange={setDetail}/><Field name="purchasePrice" title="Purchase price" type="number" value={details.purchasePrice} onChange={setDetail}/><Field name="purchaseDate" title="Purchase date" type="date" value={details.purchaseDate} onChange={setDetail}/><Field name="currentMileage" title="Current mileage" type="number" value={details.currentMileage} onChange={setDetail}/><Field name="mileageAsOf" title="Mileage date" type="date" value={details.mileageAsOf} onChange={setDetail}/></>}
              {category === 'private_investment' && <><Field name="investmentType" title="Investment type" value={details.investmentType} onChange={setDetail}/><Field name="investmentName" title="Investment name" value={details.investmentName} onChange={setDetail}/><Field name="companyName" title="Company name" value={details.companyName} onChange={setDetail}/><Field name="companyDescription" title="Company description" value={details.companyDescription} onChange={setDetail}/><Field name="website" title="Website" type="url" value={details.website} onChange={setDetail}/><Field name="investmentDate" title="Investment date" type="date" value={details.investmentDate} onChange={setDetail}/><Field name="costBasis" title="Cost basis" type="number" value={details.costBasis} onChange={setDetail}/><Field name="sharesOrUnits" title="Shares / units" type="number" value={details.sharesOrUnits} onChange={setDetail}/><Field name="unitLabel" title="Unit label" value={details.unitLabel} onChange={setDetail}/></>}
              {category === 'retirement' && <><Field name="planType" title="Plan type" value={details.planType} onChange={setDetail}/><Field name="planName" title="Plan name" value={details.planName} onChange={setDetail}/><Field name="providerName" title="Provider" value={details.providerName} onChange={setDetail}/><Field name="accountReferenceLast4" title="Account / policy last four" value={details.accountReferenceLast4} onChange={setDetail}/><Field name="startDate" title="Start date" type="date" value={details.startDate} onChange={setDetail}/><Field name="contributionAmount" title="Contribution amount" type="number" value={details.contributionAmount} onChange={setDetail}/><div><label style={label}>Contribution frequency</label><select value={String(details.contributionFrequency || '')} onChange={(e) => setDetail('contributionFrequency', e.target.value)} style={control}><option value="">Not set</option>{['weekly','biweekly','monthly','quarterly','annually'].map((item) => <option key={item}>{item}</option>)}</select></div><Field name="targetRetirementDate" title="Target retirement date" type="date" value={details.targetRetirementDate} onChange={setDetail}/></>}
            </div>
          </section>

          <section><div className="mb-4 flex items-center justify-between"><h3 className="font-display text-sm font-semibold">Ownership</h3><span className={`font-mono text-xs ${Math.abs(total - 100) < .001 ? 'text-good' : 'text-warn'}`}>{total.toFixed(2)}%</span></div>
            <div className="space-y-3">{allocations.map((allocation, index) => <div key={`${allocation.ownerId}-${index}`} className="grid grid-cols-[1fr_110px_34px] gap-2"><select aria-label="Owner" value={allocation.ownerId} onChange={(e) => setAllocations((current) => current.map((item, i) => i === index ? { ...item, ownerId: e.target.value } : item))} style={control}>{localOwners.map((owner) => <option key={owner.id} value={owner.id}>{owner.name}{owner.includeInNetWorth ? '' : ' (excluded)'}</option>)}</select><input aria-label="Ownership percentage" type="number" min="0.0001" max="100" step="0.0001" value={allocation.percentage} onChange={(e) => setAllocations((current) => current.map((item, i) => i === index ? { ...item, percentage: Number(e.target.value) } : item))} style={control}/><button type="button" aria-label="Remove owner" onClick={() => setAllocations((current) => current.filter((_, i) => i !== index))} className="text-fg4">×</button></div>)}</div>
            <div className="mt-3 grid grid-cols-[1fr_auto] gap-2"><input aria-label="New owner name" value={newOwner} onChange={(e) => setNewOwner(e.target.value)} placeholder="Add a person, company, or trust" style={control}/><Button type="button" icon={Plus} onClick={addOwner}>Owner</Button></div>
          </section>
          <div><label style={label}>Notes</label><textarea value={String(base.notes || '')} onChange={(e) => setBase((current) => ({ ...current, notes: e.target.value }))} rows={3} style={{ ...control, height: 'auto', paddingTop: 10 }} /></div>
          {error && <p role="alert" className="rounded-xl bg-rose-400/10 p-3 text-sm text-bad">{error}</p>}
        </div>
        <footer className="sticky bottom-0 flex justify-end gap-3 border-t border-card bg-bg2/95 px-5 py-4 backdrop-blur md:px-7"><Button onClick={onClose}>Cancel</Button><Button type="submit" variant="primary" disabled={saving}>{saving ? 'Saving…' : asset ? 'Save changes' : 'Create asset'}</Button></footer>
      </form>
    </aside>
  </>
}
