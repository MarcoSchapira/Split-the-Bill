import * as Dialog from '@radix-ui/react-dialog'
import { Check, X } from 'lucide-react'
import { useState } from 'react'
import {
  landingShowcaseFeatures,
  type LandingShowcaseFeature,
} from './landingContent'

function FeaturePreview({
  feature,
  onOpen,
  tilt,
}: {
  feature: LandingShowcaseFeature
  onOpen: () => void
  tilt: 'left' | 'right'
}) {
  const Icon = feature.icon

  return (
    <button
      type="button"
      className={`landing-showcase-preview landing-showcase-preview--${tilt}`}
      onClick={onOpen}
      aria-label={`Open larger preview for ${feature.title}`}
    >
      <div className="landing-showcase-preview-frame">
        {feature.image ? (
          <img src={feature.image} alt="" />
        ) : (
          <div className="landing-showcase-preview-placeholder" aria-hidden="true">
            <Icon strokeWidth={1.75} />
            <span>Preview coming soon</span>
          </div>
        )}
      </div>
      <div className="landing-showcase-preview-footer">
        <span>{feature.previewLabel}</span>
        <span aria-hidden="true" className="landing-showcase-preview-dot" />
      </div>
    </button>
  )
}

function FeatureCopy({ feature }: { feature: LandingShowcaseFeature }) {
  const Icon = feature.icon

  return (
    <div className="landing-showcase-copy">
      <div className="landing-showcase-icon" aria-hidden="true">
        <Icon strokeWidth={2} />
      </div>
      <h3>{feature.title}</h3>
      <p>{feature.description}</p>
      <ul className="landing-showcase-bullets">
        {feature.bullets.map((bullet) => (
          <li key={bullet}>
            <Check aria-hidden="true" size={18} strokeWidth={2.5} />
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function FeatureModal({
  feature,
  onClose,
}: {
  feature: LandingShowcaseFeature
  onClose: () => void
}) {
  const Icon = feature.icon

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="landing-showcase-modal-backdrop" />
        <Dialog.Content className="landing-showcase-modal">
          <div className="landing-showcase-modal-header">
            <div className="landing-showcase-modal-title-wrap">
              <div className="landing-showcase-icon landing-showcase-icon--small" aria-hidden="true">
                <Icon strokeWidth={2} />
              </div>
              <Dialog.Title>{feature.title}</Dialog.Title>
            </div>
            <Dialog.Close
              aria-label="Close feature preview"
              className="landing-showcase-modal-close"
              type="button"
            >
              <X aria-hidden="true" size={20} />
            </Dialog.Close>
          </div>
          <div className="landing-showcase-modal-scroll">
            <div className="landing-showcase-modal-body">
              <div className="landing-showcase-modal-copy">
                <p>{feature.description}</p>
                <ul className="landing-showcase-bullets">
                  {feature.bullets.map((bullet) => (
                    <li key={bullet}>
                      <Check aria-hidden="true" size={18} strokeWidth={2.5} />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="landing-showcase-modal-visual">
                {feature.image ? (
                  <img src={feature.image} alt={feature.imageAlt} />
                ) : (
                  <div className="landing-showcase-modal-placeholder" role="img" aria-label={feature.imageAlt}>
                    <Icon strokeWidth={1.5} />
                    <span>Preview coming soon</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export function LandingFeatureShowcase() {
  const [activeFeature, setActiveFeature] = useState<LandingShowcaseFeature | null>(null)

  return (
    <>
      <div className="landing-showcase-list">
        {landingShowcaseFeatures.map((feature, index) => {
          const reverse = index % 2 === 1
          const tilt = reverse ? 'left' : 'right'

          return (
            <article
              className={`landing-showcase-row${reverse ? ' landing-showcase-row--reverse' : ''}`}
              key={feature.id}
            >
              <FeatureCopy feature={feature} />
              <FeaturePreview
                feature={feature}
                onOpen={() => setActiveFeature(feature)}
                tilt={tilt}
              />
            </article>
          )
        })}
      </div>

      {activeFeature ? (
        <FeatureModal feature={activeFeature} onClose={() => setActiveFeature(null)} />
      ) : null}
    </>
  )
}
