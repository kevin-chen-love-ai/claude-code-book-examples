import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Ic } from './Icon'
import { gv } from './tokens'

export interface PersonaFormData {
    name: string
    toneKeywords: string[]
    forbiddenWords: string[]
    valuePrinciples: string[]
    styleSamples: string[]
    extraInstructions?: string
}

interface CreatePersonaModalProps {
    onClose: () => void
    onSave: (data: PersonaFormData) => Promise<void>
    initialData?: PersonaFormData | null
}

const TagInput = ({
    label,
    tags,
    setTags,
    placeholder,
}: {
    label: string
    tags: string[]
    setTags: (t: string[]) => void
    placeholder: string
}) => {
    const [val, setVal] = useState('')
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && val.trim()) {
            e.preventDefault()
            if (!tags.includes(val.trim())) setTags([...tags, val.trim()])
            setVal('')
        } else if (e.key === 'Backspace' && !val && tags.length > 0) {
            setTags(tags.slice(0, -1))
        }
    }
    return (
        <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: gv.td, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
            <div style={{
                display: 'flex', flexWrap: 'wrap', gap: 6, minHeight: 36,
                background: 'rgba(0,0,0,.3)', border: `1px solid ${gv.gbdr}`, borderRadius: 8, padding: '4px 8px', alignItems: 'center'
            }}>
                {tags.map((t, i) => (
                    <div key={i} style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        background: 'rgba(123,92,255,.15)', color: gv.tx, fontSize: 11,
                        padding: '2px 8px', borderRadius: 12, border: '1px solid rgba(123,92,255,.3)'
                    }}>
                        {t}
                        <button
                            onClick={() => setTags(tags.filter((_, idx) => idx !== i))}
                            style={{ background: 'none', border: 'none', color: gv.td, fontSize: 10, cursor: 'pointer', padding: 0, display: 'flex' }}>
                            <Ic.X />
                        </button>
                    </div>
                ))}
                <input
                    value={val} onChange={e => setVal(e.target.value)} onKeyDown={handleKeyDown} placeholder={tags.length === 0 ? placeholder : ''}
                    style={{ flex: 1, minWidth: 60, background: 'none', border: 'none', color: gv.tx, fontSize: 12, outline: 'none' }}
                />
            </div>
        </div>
    )
}

export const CreatePersonaModal: React.FC<CreatePersonaModalProps> = ({ onClose, onSave, initialData }) => {
    const { t } = useTranslation()
    const [name, setName] = useState(initialData?.name || '')
    const [toneKeywords, setToneKeywords] = useState<string[]>(initialData?.toneKeywords || [])
    const [forbiddenWords, setForbiddenWords] = useState<string[]>(initialData?.forbiddenWords || [])
    const [valuePrinciples, setValuePrinciples] = useState<string[]>(initialData?.valuePrinciples || [])

    const [sampleVal, setSampleVal] = useState('')
    const [styleSamples, setStyleSamples] = useState<string[]>(initialData?.styleSamples || [])

    const [extraInstructions, setExtraInstructions] = useState(initialData?.extraInstructions || '')
    const [isSaving, setIsSaving] = useState(false)

    const handleSave = async () => {
        if (!name.trim()) return
        setIsSaving(true)
        try {
            await onSave({
                name, toneKeywords, forbiddenWords, valuePrinciples, styleSamples, extraInstructions
            })
        } finally {
            setIsSaving(false)
            onClose()
        }
    }

    const addSample = () => {
        if (sampleVal.trim() && !styleSamples.includes(sampleVal.trim())) {
            setStyleSamples([...styleSamples, sampleVal.trim()])
            setSampleVal('')
        }
    }

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
            <div style={{
                width: 500, maxHeight: '90vh', overflowY: 'auto',
                background: gv.glass, border: `1px solid ${gv.gbdr}`, borderRadius: 16,
                boxShadow: '0 24px 48px rgba(0,0,0,.4)'
            }}>
                {/* Header */}
                <div style={{ padding: '20px 24px', borderBottom: `1px solid ${gv.gbdr}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <div style={{ fontSize: 16, fontWeight: 700 }}>{initialData ? t('personas.modal_edit_title', 'Edit Persona') : t('personas.modal_create_title', 'Create Persona')}</div>
                        <div style={{ fontSize: 12, color: gv.td, marginTop: 4 }}>{t('personas.modal_desc', 'Define the artificial identity and tone of voice.')}</div>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: gv.td, cursor: 'pointer', padding: 4, display: 'flex' }}><Ic.X /></button>
                </div>

                {/* Body */}
                <div style={{ padding: 24 }}>
                    {/* Name */}
                    <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: gv.td, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.05em' }}>{t('personas.modal_name_label', 'Persona Name')}</div>
                        <input
                            value={name} onChange={e => setName(e.target.value)} placeholder={t('personas.modal_name_placeholder', 'e.g. Growth Hacker Jane')}
                            style={{ width: '100%', height: 36, background: 'rgba(0,0,0,.3)', border: `1px solid ${gv.gbdr}`, borderRadius: 8, padding: '0 12px', color: gv.tx, fontSize: 13, outline: 'none' }}
                        />
                    </div>

                    <TagInput label={t('personas.modal_tone_label', 'Tone Keywords')} tags={toneKeywords} setTags={setToneKeywords} placeholder={t('personas.modal_tone_placeholder', 'e.g. professional, sarcastic (Press Enter)')} />
                    <TagInput label={t('personas.modal_forbidden_label', 'Forbidden Words')} tags={forbiddenWords} setTags={setForbiddenWords} placeholder={t('personas.modal_forbidden_placeholder', 'e.g. utilize, synergy, dear sir')} />
                    <TagInput label={t('personas.modal_values_label', 'Core Values / Principles')} tags={valuePrinciples} setTags={setValuePrinciples} placeholder={t('personas.modal_values_placeholder', 'e.g. Add value first, Be authentic')} />

                    {/* Style Samples */}
                    <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: gv.td, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.05em' }}>{t('personas.modal_style_label', 'Style Samples (Good Examples)')}</div>
                        {styleSamples.map((s, i) => (
                            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, background: 'rgba(0,0,0,.2)', padding: '8px 12px', borderRadius: 8, border: `1px solid ${gv.gbdr}` }}>
                                <div style={{ flex: 1, fontSize: 12, color: gv.td, whiteSpace: 'pre-wrap' }}>{s}</div>
                                <button onClick={() => setStyleSamples(styleSamples.filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', color: gv.ts, cursor: 'pointer', padding: 4 }}><Ic.X /></button>
                            </div>
                        ))}
                        <div style={{ display: 'flex', gap: 8 }}>
                            <textarea
                                value={sampleVal} onChange={e => setSampleVal(e.target.value)} placeholder={t('personas.modal_style_placeholder', 'Paste an example of a good post here...')}
                                style={{ flex: 1, minHeight: 60, background: 'rgba(0,0,0,.3)', border: `1px solid ${gv.gbdr}`, borderRadius: 8, padding: '8px 12px', color: gv.tx, fontSize: 12, outline: 'none', resize: 'vertical' }}
                            />
                            <button disabled={!sampleVal.trim()} onClick={addSample} style={{ height: 36, padding: '0 16px', background: 'rgba(255,255,255,.05)', border: `1px solid ${gv.gbdr}`, borderRadius: 8, color: gv.tx, fontSize: 12, fontWeight: 600, cursor: sampleVal.trim() ? 'pointer' : 'not-allowed', opacity: sampleVal.trim() ? 1 : 0.5 }}>{t('personas.modal_style_add', 'Add')}</button>
                        </div>
                    </div>

                    {/* Extra */}
                    <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: gv.td, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.05em' }}>{t('personas.modal_extra_label', 'Extra Instructions (Optional)')}</div>
                        <textarea
                            value={extraInstructions} onChange={e => setExtraInstructions(e.target.value)} placeholder={t('personas.modal_extra_placeholder', 'Any other specific system prompt instructions...')}
                            style={{ width: '100%', minHeight: 60, background: 'rgba(0,0,0,.3)', border: `1px solid ${gv.gbdr}`, borderRadius: 8, padding: '8px 12px', color: gv.tx, fontSize: 12, outline: 'none', resize: 'vertical' }}
                        />
                    </div>
                </div>

                {/* Footer */}
                <div style={{ padding: '16px 24px', borderTop: `1px solid ${gv.gbdr}`, display: 'flex', justifyContent: 'flex-end', gap: 12, background: 'rgba(0,0,0,.2)' }}>
                    <button onClick={onClose} style={{ height: 36, padding: '0 16px', background: 'transparent', border: 'none', color: gv.ts, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{t('personas.modal_cancel', 'Cancel')}</button>
                    <button disabled={isSaving || !name.trim()} onClick={handleSave} style={{ height: 36, padding: '0 20px', background: name.trim() ? gv.cc : 'rgba(255,255,255,.05)', border: 'none', borderRadius: 8, color: name.trim() ? '#000' : gv.td, fontSize: 13, fontWeight: 600, cursor: name.trim() ? 'pointer' : 'not-allowed', opacity: isSaving ? 0.7 : 1 }}>
                        {isSaving ? t('personas.modal_saving', 'Saving...') : t('personas.modal_save', 'Save Persona')}
                    </button>
                </div>
            </div>
        </div>
    )
}
