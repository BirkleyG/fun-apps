import { createEmptySection, createEmptyTemplate } from "../lib/templates";

export default function TemplatesEditor({ templates, onSave, onDelete }) {
  const addTemplate = () => onSave(createEmptyTemplate());

  const updateTemplate = (template, patch) => onSave({ ...template, ...patch });

  const updateSection = (template, sectionId, patch) =>
    onSave({
      ...template,
      sections: template.sections.map((s) => (s.id === sectionId ? { ...s, ...patch } : s))
    });

  const addSection = (template) =>
    onSave({ ...template, sections: [...template.sections, createEmptySection()] });

  const removeSection = (template, sectionId) =>
    onSave({ ...template, sections: template.sections.filter((s) => s.id !== sectionId) });

  return (
    <div className="templates-editor">
      <div className="templates-editor__header">
        <h2>Templates</h2>
        <button className="btn btn--ghost" onClick={addTemplate}>
          + New template
        </button>
      </div>
      <p className="hint">
        Each section can have optional keywords (comma-separated) that guide the formatter — e.g. an "Action Items"
        section with hint "will, need to, follow up" pulls in matching lines. Leave the hint blank for an open
        summary section.
      </p>

      <div className="templates-editor__list">
        {templates.map((template) => (
          <div className="template-card" key={template.id}>
            <div className="template-card__row">
              <input
                className="input input--title"
                value={template.name}
                onChange={(e) => updateTemplate(template, { name: e.target.value })}
              />
              <button className="btn btn--danger-ghost" onClick={() => onDelete(template.id)}>
                Delete
              </button>
            </div>

            <div className="template-card__sections">
              {template.sections.map((section) => (
                <div className="section-row" key={section.id}>
                  <input
                    className="input"
                    placeholder="Section title"
                    value={section.title}
                    onChange={(e) => updateSection(template, section.id, { title: e.target.value })}
                  />
                  <input
                    className="input"
                    placeholder="Keyword hints (optional)"
                    value={section.hint || ""}
                    onChange={(e) => updateSection(template, section.id, { hint: e.target.value })}
                  />
                  <button className="btn btn--icon" onClick={() => removeSection(template, section.id)} title="Remove section">
                    ×
                  </button>
                </div>
              ))}
              <button className="btn btn--ghost btn--small" onClick={() => addSection(template)}>
                + Add section
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
