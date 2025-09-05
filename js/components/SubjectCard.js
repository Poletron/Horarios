/**
 * SubjectCard Component
 * 
 * A redesigned card component for displaying subject information with improved
 * visual hierarchy, better space utilization, and enhanced selection indicators.
 * 
 * Features:
 * - Semantic color coding for selection states
 * - Consistent iconography
 * - Improved visual hierarchy
 * - Better space utilization
 * - Smooth animations and transitions
 */

export default {
  props: {
    subject: {
      type: Object,
      required: true
    },
    isSelected: {
      type: Boolean,
      default: false
    },
    selectionType: {
      type: String,
      default: null,
      validator: value => value === null || ['priority', 'candidate'].includes(value)
    },
    isExpanded: {
      type: Boolean,
      default: false
    },
    selectionMode: {
      type: String,
      required: true,
      validator: value => ['subject', 'section'].includes(value)
    },
    onlyOpenSections: {
      type: Boolean,
      default: true
    },
    selectedSections: {
      type: Array,
      default: () => []
    }
  },

  emits: ['toggle-selection', 'toggle-expansion', 'section-selection'],

  computed: {
    /**
     * Calculate statistics for the subject
     */
    subjectStats() {
      const totalSections = this.subject.sections?.length || 0;
      const openSections = this.subject.sections?.filter(section => section.openSection).length || 0;
      const credits = this.subject.creditHourLow || 0;
      
      return {
        totalSections,
        openSections,
        credits,
        availabilityPercentage: totalSections > 0 ? Math.round((openSections / totalSections) * 100) : 0
      };
    },

    /**
     * Get card CSS classes based on selection state
     */
    cardClasses() {
      return [
        'subject-card',
        {
          'subject-card--selected-priority': this.isSelected && this.selectionType === 'priority',
          'subject-card--selected-candidate': this.isSelected && this.selectionType === 'candidate',
          'subject-card--expanded': this.isExpanded,
          'subject-card--clickable': this.selectionMode === 'subject'
        }
      ];
    },

    /**
     * Get selection indicator configuration
     */
    selectionIndicator() {
      if (!this.isSelected) return null;
      
      return {
        type: this.selectionType,
        icon: this.selectionType === 'priority' ? '🔴' : '🟡',
        label: this.selectionType === 'priority' ? 'Prioritaria' : 'Candidata',
        class: `selection-indicator--${this.selectionType}`
      };
    },

    /**
     * Check if subject has HTML data
     */
    hasHtmlData() {
      return this.subject.sections?.some(section => section.dataSource === 'html') || false;
    },

    /**
     * Get availability status configuration
     */
    availabilityStatus() {
      const { openSections, totalSections, availabilityPercentage } = this.subjectStats;
      
      let status = 'low';
      let icon = '❌';
      let color = 'danger';
      
      if (availabilityPercentage >= 70) {
        status = 'high';
        icon = '✅';
        color = 'success';
      } else if (availabilityPercentage >= 30) {
        status = 'medium';
        icon = '⚠️';
        color = 'warning';
      }
      
      return {
        status,
        icon,
        color,
        text: `${openSections}/${totalSections} disponibles`,
        percentage: availabilityPercentage
      };
    },

    /**
     * Format subject sections for display
     */
    formattedSections() {
      if (!this.subject.sections || this.subject.sections.length === 0) {
        return 'Sin secciones disponibles';
      }

      const sampleNRCs = this.subject.sections
        .slice(0, 2)
        .map(section => section.courseReferenceNumber)
        .filter(Boolean)
        .join(', ');

      const hasMore = this.subject.sections.length > 2;
      const nrcText = sampleNRCs ? ` (NRCs: ${sampleNRCs}${hasMore ? '...' : ''})` : '';
      
      return `${this.subjectStats.openSections} de ${this.subjectStats.totalSections} secciones abiertas${nrcText}`;
    }
  },

  methods: {
    /**
     * Handle subject card click
     */
    handleCardClick() {
      if (this.selectionMode === 'subject') {
        this.$emit('toggle-selection', this.subject);
      }
    },

    /**
     * Handle expansion toggle
     */
    handleExpansionToggle(event) {
      event.stopPropagation();
      this.$emit('toggle-expansion', this.subject.id);
    },

    /**
     * Handle section selection
     */
    handleSectionSelection(section, event) {
      event.stopPropagation();
      this.$emit('section-selection', section, this.subject);
    },

    /**
     * Format section schedule for display
     */
    formatSectionSchedule(section) {
      if (!section.meetingsFaculty || section.meetingsFaculty.length === 0) {
        return 'Sin horario definido';
      }
      
      const schedules = section.meetingsFaculty.map(meeting => {
        if (!meeting.meetingTime) return '';
        
        const days = [];
        if (meeting.meetingTime.monday) days.push('L');
        if (meeting.meetingTime.tuesday) days.push('M');
        if (meeting.meetingTime.wednesday) days.push('W');
        if (meeting.meetingTime.thursday) days.push('J');
        if (meeting.meetingTime.friday) days.push('V');
        if (meeting.meetingTime.saturday) days.push('S');
        if (meeting.meetingTime.sunday) days.push('D');
        
        const time = `${meeting.meetingTime.beginTime}-${meeting.meetingTime.endTime}`;
        return `${days.join('')} ${time}`;
      }).filter(schedule => schedule).join(', ');
      
      return schedules || 'Sin horario definido';
    },

    /**
     * Check if a section is selected
     */
    isSectionSelected(sectionId) {
      return this.selectedSections.some(item => 
        item.type === 'section' && item.item.id === sectionId
      );
    },

    /**
     * Get section selection type
     */
    getSectionSelectionType(sectionId) {
      const selectedSection = this.selectedSections.find(item => 
        item.type === 'section' && item.item.id === sectionId
      );
      return selectedSection ? selectedSection.selectionType : null;
    }
  },

  template: `
    <div 
      :class="cardClasses"
      :data-subject-id="subject.id"
      @click="handleCardClick"
    >
      <!-- Card Header -->
      <div class="subject-card__header">
        <!-- Data Source Indicator -->
        <div v-if="hasHtmlData" 
             class="data-source-indicator data-source-html"
             title="Datos actualizados desde HTML">
          HTML
        </div>
        <div v-else 
             class="data-source-indicator data-source-json"
             title="Datos desde JSON original">
          JSON
        </div>
        
        <div class="subject-card__main-info">
          <!-- Subject Code and Title -->
          <div class="subject-card__identity">
            <h3 class="subject-card__code">
              <span class="subject-card__code-icon">📚</span>
              {{ subject.subject }}{{ subject.courseNumber }}
            </h3>
            <p class="subject-card__title">{{ subject.courseTitle }}</p>
          </div>

          <!-- Subject Statistics -->
          <div class="subject-card__stats">
            <div class="subject-card__stat-item">
              <span class="subject-card__stat-icon">🎓</span>
              <span class="subject-card__stat-value">{{ subjectStats.credits }}</span>
              <span class="subject-card__stat-label">créditos</span>
            </div>
            
            <div class="subject-card__stat-item">
              <span class="subject-card__stat-icon">{{ availabilityStatus.icon }}</span>
              <span class="subject-card__stat-value">{{ subjectStats.openSections }}</span>
              <span class="subject-card__stat-label">disponibles</span>
            </div>
            
            <div class="subject-card__stat-item">
              <span class="subject-card__stat-icon">📊</span>
              <span class="subject-card__stat-value">{{ availabilityStatus.percentage }}%</span>
              <span class="subject-card__stat-label">disponibilidad</span>
            </div>
          </div>
        </div>

        <!-- Selection and Actions -->
        <div class="subject-card__actions">
          <!-- Selection Indicator -->
          <div v-if="selectionIndicator" class="subject-card__selection-indicator">
            <div :class="['selection-badge', selectionIndicator.class]">
              <span class="selection-badge__icon">{{ selectionIndicator.icon }}</span>
              <span class="selection-badge__label">{{ selectionIndicator.label }}</span>
            </div>
            <div class="selection-checkmark">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16">
                <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/>
              </svg>
            </div>
          </div>

          <!-- Expand/Collapse Button -->
          <button 
            @click="handleExpansionToggle"
            class="subject-card__expand-btn"
            :class="{ 'subject-card__expand-btn--expanded': isExpanded }"
            :aria-expanded="isExpanded"
            :aria-label="isExpanded ? 'Ocultar secciones' : 'Ver secciones'"
          >
            <span class="subject-card__expand-icon">
              {{ isExpanded ? '🔼' : '🔽' }}
            </span>
            <span class="subject-card__expand-text">
              {{ isExpanded ? 'Ocultar' : 'Ver' }} Secciones
            </span>
          </button>
        </div>
      </div>

      <!-- Availability Progress Bar -->
      <div class="subject-card__availability-bar">
        <div 
          class="subject-card__availability-fill"
          :class="'subject-card__availability-fill--' + availabilityStatus.color"
          :style="{ width: availabilityStatus.percentage + '%' }"
        ></div>
      </div>

      <!-- Sections List (Expandable) -->
      <div v-if="isExpanded" class="subject-card__sections">
        <div class="subject-card__sections-header">
          <h4 class="subject-card__sections-title">
            <span class="subject-card__sections-icon">📋</span>
            Secciones Disponibles
          </h4>
          <div class="subject-card__sections-summary">
            {{ formattedSections }}
          </div>
        </div>

        <div class="subject-card__sections-list">
          <div 
            v-for="section in subject.sections" 
            :key="section.id"
            class="section-card"
            :data-section-id="section.id"
            :class="{
              'section-card--selected-priority': isSectionSelected(section.id) && getSectionSelectionType(section.id) === 'priority',
              'section-card--selected-candidate': isSectionSelected(section.id) && getSectionSelectionType(section.id) === 'candidate',
              'section-card--closed': !section.openSection,
              'section-card--clickable': selectionMode === 'section'
            }"
            @click="selectionMode === 'section' ? handleSectionSelection(section, $event) : null"
          >
            <!-- Section Header -->
            <div class="section-card__header">
              <!-- Section Data Source Indicator -->
              <div v-if="section.dataSource === 'html'" 
                   class="data-source-indicator data-source-html section-data-source"
                   title="Datos actualizados desde HTML">
                HTML
              </div>
              <div v-else 
                   class="data-source-indicator data-source-json section-data-source"
                   title="Datos desde JSON original">
                JSON
              </div>
              
              <div class="section-card__identity">
                <div class="section-card__nrc">
                  <span class="section-card__nrc-icon">🏷️</span>
                  {{ section.courseReferenceNumber }}
                </div>
                <div class="section-card__sequence">
                  Sec. {{ section.sequenceNumber }}
                </div>
                <div class="section-card__status" :class="'section-card__status--' + (section.openSection ? 'open' : 'closed')">
                  <span class="section-card__status-icon">{{ section.openSection ? '✅' : '❌' }}</span>
                  <span class="section-card__status-text">{{ section.openSection ? 'Abierta' : 'Cerrada' }}</span>
                </div>
                <!-- Show professor name if from HTML -->
                <div v-if="section.dataSource === 'html' && section.professorName" 
                     class="section-card__professor"
                     :class="section.professorName === 'Por Asignar' ? 'section-card__professor--unassigned' : 'section-card__professor--assigned'">
                  <span class="section-card__professor-icon">👨‍🏫</span>
                  <span class="section-card__professor-name">{{ section.professorName }}</span>
                </div>
              </div>

              <!-- Section Selection Indicator -->
              <div v-if="isSectionSelected(section.id)" class="section-card__selection">
                <div class="selection-badge" :class="'selection-badge--' + getSectionSelectionType(section.id)">
                  <span class="selection-badge__icon">{{ getSectionSelectionType(section.id) === 'priority' ? '🔴' : '🟡' }}</span>
                  <span class="selection-badge__label">{{ getSectionSelectionType(section.id) === 'priority' ? 'Prioritaria' : 'Candidata' }}</span>
                </div>
              </div>
            </div>

            <!-- Section Details -->
            <div class="section-card__details">
              <div class="section-card__schedule">
                <span class="section-card__schedule-icon">⏰</span>
                <span class="section-card__schedule-text">{{ formatSectionSchedule(section) }}</span>
              </div>
              <div class="section-card__campus">
                <span class="section-card__campus-icon">🏢</span>
                <span class="section-card__campus-text">{{ section.campusDescription }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
};