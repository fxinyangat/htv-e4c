import { useState } from 'react'
import { X, Link2 } from 'lucide-react'
import { Company, KnockoutStatus, AXIS_LABELS, updateCompany, updateRealCompany, isRealCompanyId } from '../api'
import { useToast } from '../context/ToastContext'
import { useTaxonomy } from '../context/TaxonomyContext'
import { isValidDomain, isValidUrl } from '../utils/validation'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-ht-blue/70 mb-1.5">{label}</label>
      {children}
    </div>
  )
}

const inputCls = "w-full px-4 py-2.5 text-sm bg-white border border-ht-blue/10 rounded-xl focus:outline-none focus:border-ht-orange/40 focus:ring-4 focus:ring-ht-orange/10 transition-all text-ht-blue placeholder:text-ht-blue/30 shadow-sm"
const inputErrorCls = "w-full px-4 py-2.5 text-sm bg-white border border-red-300 rounded-xl focus:outline-none focus:border-red-400 focus:ring-4 focus:ring-red-100 transition-all text-ht-blue placeholder:text-ht-blue/30 shadow-sm"

const selectCls = `${inputCls} appearance-none pr-10 cursor-pointer`
const selectArrowStyle = {
  backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 0.85rem center',
  backgroundSize: '1em',
} as const

function ChipMultiSelect({ options, values, onChange }: { options: string[]; values: string[]; onChange: (v: string[]) => void }) {
  const [adding, setAdding] = useState(false)
  const remaining = options.filter(o => !values.includes(o))
  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 border border-ht-blue/10 rounded-xl bg-white min-h-[46px] shadow-sm">
      {values.map(v => (
        <span key={v} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-ht-blue/5 text-ht-blue text-xs font-medium">
          {v}
          <button type="button" onClick={() => onChange(values.filter(x => x !== v))} className="hover:text-red-600 transition-colors">
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      {adding ? (
        <select
          autoFocus
          value=""
          onChange={e => { if (e.target.value) onChange([...values, e.target.value]); setAdding(false) }}
          onBlur={() => setAdding(false)}
          className="text-xs border border-ht-blue/10 rounded-lg pl-2 pr-7 py-1 appearance-none cursor-pointer focus:outline-none"
          style={selectArrowStyle}
        >
          <option value="">Select…</option>
          {remaining.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        remaining.length > 0 && (
          <button type="button" onClick={() => setAdding(true)} className="text-xs font-semibold text-ht-orange hover:text-ht-orange/80">
            + Add
          </button>
        )
      )}
    </div>
  )
}

interface Props {
  company: Company
  onClose: () => void
  onSaved: () => void
}

export default function EditCompanyModal({ company, onClose, onSaved }: Props) {
  const { showToast } = useToast()
  const { taxonomy, originCategories, allieKnockoutStates, andraKnockoutStates } = useTaxonomy()
  const activeTags = company.tags.filter(t => t.is_accepted !== false)
  const valuesFor = (axis: string) => activeTags.filter(t => t.axis === axis).map(t => t.value)

  const [name, setName] = useState(company.name)
  const [description, setDescription] = useState(company.description)
  const [domain, setDomain] = useState(company.domain)
  const [linkedin, setLinkedin] = useState(company.linkedin_url ?? '')
  const [location, setLocation] = useState(company.location)
  const [originSource, setOriginSource] = useState(company.origin_source)
  const [originCategory, setOriginCategory] = useState(company.origin_category ?? '')
  const [allie, setAllie] = useState<KnockoutStatus>(company.allie_knockout)
  const [andra, setAndra] = useState<KnockoutStatus>(company.andra_knockout)
  const [industries, setIndustries] = useState<string[]>(valuesFor('industry'))
  const [stages, setStages] = useState<string[]>(valuesFor('construction_stage'))
  const [productTypes, setProductTypes] = useState<string[]>(valuesFor('product_type'))
  const [techTypes, setTechTypes] = useState<string[]>(valuesFor('technology_type'))
  const [region, setRegion] = useState<string[]>(company.region)
  const [saving, setSaving] = useState(false)
  const [touched, setTouched] = useState(false)

  const nameError = name.trim() ? '' : 'Company name is required'
  const domainError = domain.trim() ? (!isValidDomain(domain) ? 'Enter a valid domain (e.g. groforma.com)' : '') : 'Domain is required'
  const linkedinError = linkedin.trim() && !isValidUrl(linkedin) ? 'Enter a valid URL' : ''

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (nameError || domainError || linkedinError) return
    const update = {
      name, description, domain,
      linkedin_url: linkedin.trim() || null,
      location, origin_source: originSource,
      origin_category: originCategory || null,
      allie_knockout: allie, andra_knockout: andra,
      region,
      industry: industries,
      construction_stage: stages,
      product_type: productTypes,
      technology_type: techTypes,
    }
    setSaving(true)
    if (isRealCompanyId(company.id)) {
      try {
        await updateRealCompany(company.id, update)
        showToast('success', 'Changes saved', 'Company record has been updated successfully.')
        onSaved()
      } catch (err) {
        console.error('Failed to save changes to Notion:', err)
        showToast('error', 'Save failed', 'Could not save changes to Notion.')
      } finally {
        setSaving(false)
      }
      return
    }
    await updateCompany(company.id, update)
    setSaving(false)
    showToast('success', 'Changes saved', 'Company record has been updated successfully.')
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-ht-blue/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-8 py-5 border-b border-ht-blue/10 shrink-0">
          <h2 className="text-xl font-display font-semibold text-ht-blue tracking-tight">Edit Company — {company.name}</h2>
          <button onClick={onClose} className="text-ht-blue/40 hover:text-ht-blue transition-colors flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form id="edit-company-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-6">
          <h4 className="text-[11px] font-bold text-ht-blue/40 uppercase tracking-widest">Company Info</h4>

          <Field label="Company Name">
            <input type="text" value={name} onChange={e => setName(e.target.value)} className={touched && nameError ? inputErrorCls : inputCls} />
            {touched && nameError && <p className="text-xs text-red-500 mt-1.5">{nameError}</p>}
          </Field>

          <Field label="Description">
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className={`${inputCls} resize-none`} />
          </Field>

          <Field label="Domain">
            <input type="text" value={domain} onChange={e => setDomain(e.target.value)} placeholder="e.g. groforma.com" className={touched && domainError ? inputErrorCls : inputCls} />
            {touched && domainError && <p className="text-xs text-red-500 mt-1.5">{domainError}</p>}
          </Field>

          <Field label="LinkedIn URL">
            <div className="relative">
              <Link2 className="w-4 h-4 text-ht-blue/30 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={linkedin}
                onChange={e => setLinkedin(e.target.value)}
                placeholder="linkedin.com/company/…"
                className={`${touched && linkedinError ? inputErrorCls : inputCls} pl-10`}
              />
            </div>
            {touched && linkedinError && <p className="text-xs text-red-500 mt-1.5">{linkedinError}</p>}
          </Field>

          <Field label="Location">
            <input type="text" value={location} onChange={e => setLocation(e.target.value)} className={inputCls} />
          </Field>

          <Field label="Origin Source">
            <input type="text" value={originSource} onChange={e => setOriginSource(e.target.value)} placeholder="e.g. LinkedIn, Email" className={inputCls} />
          </Field>

          <Field label="Origin Category">
            <select value={originCategory} onChange={e => setOriginCategory(e.target.value)} className={selectCls} style={selectArrowStyle}>
              <option value="">Select category</option>
              {originCategories.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </Field>

          <Field label="Allie Knockout Pass/Fail">
            <select value={allie ?? ''} onChange={e => setAllie((e.target.value || null) as KnockoutStatus)} className={selectCls} style={selectArrowStyle}>
              <option value="">Select…</option>
              {(allieKnockoutStates ?? []).map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </Field>

          <Field label="Andra Knockout Pass/Fail">
            <select value={andra ?? ''} onChange={e => setAndra((e.target.value || null) as KnockoutStatus)} className={selectCls} style={selectArrowStyle}>
              <option value="">Select…</option>
              {(andraKnockoutStates ?? []).map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </Field>

          <h4 className="text-[11px] font-bold text-ht-blue/40 uppercase tracking-widest pt-2">Classification Tags</h4>

          <Field label={`${AXIS_LABELS.industry} (HVC)`}>
            <ChipMultiSelect options={taxonomy.industry} values={industries} onChange={setIndustries} />
          </Field>

          <Field label={`${AXIS_LABELS.construction_stage} (HVC)`}>
            <ChipMultiSelect options={taxonomy.construction_stage} values={stages} onChange={setStages} />
          </Field>

          <Field label={`${AXIS_LABELS.product_type} (HVC)`}>
            <ChipMultiSelect options={taxonomy.product_type} values={productTypes} onChange={setProductTypes} />
          </Field>

          <Field label={`${AXIS_LABELS.technology_type} (HVC)`}>
            <ChipMultiSelect options={taxonomy.technology_type} values={techTypes} onChange={setTechTypes} />
          </Field>

          <Field label={`${AXIS_LABELS.region} (HTV)`}>
            <ChipMultiSelect options={taxonomy.region} values={region} onChange={setRegion} />
          </Field>

          <p className="text-xs text-ht-blue/40 text-center pt-1">Classification changes will be saved as Human-reviewed and override AI tags.</p>
        </form>

        <div className="flex gap-3 px-8 py-5 border-t border-ht-blue/10 shrink-0">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 bg-white border border-ht-blue/10 text-ht-blue text-sm font-semibold rounded-xl hover:bg-ht-blue/5 transition-colors">
            Cancel
          </button>
          <button type="submit" form="edit-company-form" disabled={saving} className="flex-1 py-2.5 bg-ht-blue text-white text-sm font-semibold rounded-xl hover:shadow-lg hover:shadow-ht-blue/30 transition-all disabled:opacity-50">
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
