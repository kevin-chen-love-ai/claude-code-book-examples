import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Card } from '../components/Card'
import { Ic } from '../components/Icon'
import { gv } from '../components/tokens'
import { CreatePersonaModal, type PersonaFormData } from '../components/CreatePersonaModal'

interface PersonaConfig {
    id: string
    name: string
    toneKeywords: string[]
    forbiddenWords: string[]
    valuePrinciples: string[]
    styleSamples: string[]
    extraInstructions?: string
}

export function PersonasPage() {
    const { t } = useTranslation()
    const queryClient = useQueryClient()
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingPersona, setEditingPersona] = useState<PersonaConfig | null>(null)

    const { data: personas = [], isLoading } = useQuery({
        queryKey: ['personas'],
        queryFn: async () => {
            if (!window.electronAPI) return []
            return (await window.electronAPI.personas.list()) as PersonaConfig[]
        },
    })

    const createMutation = useMutation({
        mutationFn: async (data: PersonaFormData) => {
            if (!window.electronAPI) return
            return await window.electronAPI.personas.create(data)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['personas'] })
            setIsModalOpen(false)
        }
    })

    const updateMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: PersonaFormData }) => {
            if (!window.electronAPI) return
            return await window.electronAPI.personas.update(id, data)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['personas'] })
            setIsModalOpen(false)
            setEditingPersona(null)
        }
    })

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            if (!window.electronAPI) return
            return await window.electronAPI.personas.delete(id)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['personas'] })
        }
    })

    const handleSave = async (data: PersonaFormData) => {
        if (editingPersona) {
            await updateMutation.mutateAsync({ id: editingPersona.id, data })
        } else {
            await createMutation.mutateAsync(data)
        }
    }

    const handleEdit = (p: PersonaConfig) => {
        setEditingPersona(p)
        setIsModalOpen(true)
    }

    const handleDelete = async (id: string) => {
        if (confirm(t('personas.delete_confirm', 'Are you sure you want to delete this persona?'))) {
            await deleteMutation.mutateAsync(id)
        }
    }

    return (
        <div style={{ padding: 32, maxWidth: 1200, margin: '0 auto', width: '100%', height: '100%', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
                <div>
                    <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-.03em', color: gv.tx }}>{t('personas.title', 'Persona Hub')}</div>
                    <div style={{ fontSize: 13, color: gv.td, marginTop: 4 }}>{t('personas.description', 'Manage the identity, voice, and guardrails for your virtual operators.')}</div>
                </div>
                <button
                    onClick={() => {
                        setEditingPersona(null)
                        setIsModalOpen(true)
                    }}
                    disabled={createMutation.isPending}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '0 16px', height: 36, borderRadius: 8, border: 'none',
                        background: gv.cc, color: '#000', fontSize: 13, fontWeight: 700,
                        cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,229,204,.2)'
                    }}>
                    <Ic.Plus />
                    {t('personas.create_btn', 'Create Persona')}
                </button>
            </div>

            {isLoading ? (
                <div style={{ color: gv.td, fontSize: 13 }}>{t('personas.loading', 'Loading personas...')}</div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
                    {personas.map((p) => (
                        <Card key={p.id}>
                            <div style={{ padding: 20 }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg, rgba(123,92,255,.2), rgba(0,229,204,.2))', border: `1px solid rgba(255,255,255,.1)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: gv.cc }}>
                                            <Ic.Agent />
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 16, fontWeight: 700, color: gv.tx }}>{p.name}</div>
                                            <div style={{ fontSize: 11, color: gv.td, marginTop: 2, fontFamily: 'monospace' }}>{p.id}</div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 4 }}>
                                        <button onClick={() => handleEdit(p)} style={{ background: 'none', border: 'none', color: gv.td, cursor: 'pointer', padding: 4 }}><Ic.Gear /></button>
                                        {p.id !== 'default' && (
                                            <button onClick={() => handleDelete(p.id)} disabled={deleteMutation.isPending} style={{ background: 'none', border: 'none', color: '#ff4d4d', cursor: 'pointer', padding: 4 }}><Ic.Trash /></button>
                                        )}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    <div>
                                        <div style={{ fontSize: 10, fontWeight: 700, color: gv.td, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>{t('personas.tone_keywords', 'Tone / Keywords')}</div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                            {p.toneKeywords.slice(0, 3).map((t, i) => (
                                                <div key={i} style={{ fontSize: 11, padding: '2px 8px', background: 'rgba(123,92,255,.15)', color: '#a78bfa', borderRadius: 4 }}>{t}</div>
                                            ))}
                                            {p.toneKeywords.length > 3 && <div style={{ fontSize: 11, padding: '2px 8px', background: 'rgba(255,255,255,.05)', color: gv.td, borderRadius: 4 }}>+{p.toneKeywords.length - 3}</div>}
                                        </div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 10, fontWeight: 700, color: gv.td, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>{t('personas.forbidden_words', 'Forbidden')}</div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                            {p.forbiddenWords.length === 0 ? <span style={{ fontSize: 11, color: gv.td }}>-</span> : null}
                                            {p.forbiddenWords.slice(0, 3).map((t, i) => (
                                                <div key={i} style={{ fontSize: 11, padding: '2px 8px', background: 'rgba(239,68,68,.15)', color: '#fca5a5', borderRadius: 4 }}>{t}</div>
                                            ))}
                                            {p.forbiddenWords.length > 3 && <div style={{ fontSize: 11, padding: '2px 8px', background: 'rgba(255,255,255,.05)', color: gv.td, borderRadius: 4 }}>+{p.forbiddenWords.length - 3}</div>}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            {isModalOpen && (
                <CreatePersonaModal
                    initialData={editingPersona}
                    onClose={() => {
                        setIsModalOpen(false)
                        setEditingPersona(null)
                    }}
                    onSave={handleSave}
                />
            )}
        </div>
    )
}
