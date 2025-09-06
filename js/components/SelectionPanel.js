export default {
  props: {
    selectedItems: {
      type: Array,
      default: () => []
    },
    onlyOpenSections: {
      type: Boolean,
      default: true
    },
    selectedCampus: {
      type: String,
      default: ''
    },
    campuses: {
      type: Array,
      default: () => []
    },
    generatingSchedules: {
      type: Boolean,
      default: false
    }
  },

  computed: {
    priorityItems() {
      return this.selectedItems.filter(item => item.selectionType === 'priority');
    },
    
    candidateItems() {
      return this.selectedItems.filter(item => item.selectionType === 'candidate');
    },
    
    prioritySubjects() {
      return this.priorityItems.filter(item => item.type === 'subject');
    },
    
    candidateSubjects() {
      return this.candidateItems.filter(item => item.type === 'subject');
    },
    
    prioritySections() {
      return this.priorityItems.filter(item => item.type === 'section');
    },
    
    candidateSections() {
      return this.candidateItems.filter(item => item.type === 'section');
    },

    // Statistics computation
    selectionStats() {
      const stats = {
        totalItems: this.selectedItems.length,
        totalCredits: 0,
        priorityCredits: 0,
        candidateCredits: 0,
        dayDistribution: {
          monday: 0,
          tuesday: 0,
          wednesday: 0,
          thursday: 0,
          friday: 0,
          saturday: 0,
          sunday: 0
        },
        conflicts: this.detectConflicts(),
        openSections: 0,
        closedSections: 0
      };

      // Calculate credits
      this.selectedItems.forEach(item => {
        const credits = this.getItemCredits(item);
        stats.totalCredits += credits;
        
        if (item.selectionType === 'priority') {
          stats.priorityCredits += credits;
        } else {
          stats.candidateCredits += credits;
        }

        // Count day distribution and section status
        if (item.type === 'section') {
          this.updateDayDistribution(item.item, stats.dayDistribution);
          if (item.item.openSection) {
            stats.openSections++;
          } else {
            stats.closedSections++;
          }
        } else if (item.type === 'subject') {
          // For subjects, count all sections
          item.item.sections.forEach(section => {
            this.updateDayDistribution(section, stats.dayDistribution);
            if (section.openSection) {
              stats.openSections++;
            } else {
              stats.closedSections++;
            }
          });
        }
      });

      return stats;
    },

    hasConflicts() {
      return this.selectionStats.conflicts.length > 0;
    },

    conflictSeverity() {
      const conflicts = this.selectionStats.conflicts;
      if (conflicts.some(c => c.severity === 'error')) return 'error';
      if (conflicts.some(c => c.severity === 'warning')) return 'warning';
      return 'none';
    }
  },

  methods: {
    getItemCredits(item) {
      if (item.type === 'subject') {
        return parseInt(item.item.creditHourLow) || 0;
      } else if (item.type === 'section' && item.subjectInfo) {
        return parseInt(item.subjectInfo.creditHourLow) || 0;
      }
      return 0;
    },

    updateDayDistribution(section, distribution) {
      if (!section.meetingsFaculty || section.meetingsFaculty.length === 0) return;
      
      section.meetingsFaculty.forEach(meeting => {
        if (!meeting.meetingTime) return;
        
        const days = meeting.meetingTime;
        if (days.monday) distribution.monday++;
        if (days.tuesday) distribution.tuesday++;
        if (days.wednesday) distribution.wednesday++;
        if (days.thursday) distribution.thursday++;
        if (days.friday) distribution.friday++;
        if (days.saturday) distribution.saturday++;
        if (days.sunday) distribution.sunday++;
      });
    },

    detectConflicts() {
      const conflicts = [];
      const scheduleMap = new Map();

      // Collect all scheduled times
      this.selectedItems.forEach(item => {
        const sections = item.type === 'subject' ? item.item.sections : [item.item];
        
        sections.forEach(section => {
          if (!section.meetingsFaculty) return;
          
          section.meetingsFaculty.forEach(meeting => {
            if (!meeting.meetingTime) return;
            
            const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
            days.forEach(day => {
              if (meeting.meetingTime[day]) {
                const timeKey = `${day}-${meeting.meetingTime.beginTime}-${meeting.meetingTime.endTime}`;
                
                if (!scheduleMap.has(timeKey)) {
                  scheduleMap.set(timeKey, []);
                }
                
                scheduleMap.get(timeKey).push({
                  item,
                  section,
                  meeting,
                  day,
                  beginTime: meeting.meetingTime.beginTime,
                  endTime: meeting.meetingTime.endTime
                });
              }
            });
          });
        });
      });

      // Check for time conflicts
      scheduleMap.forEach((entries, timeKey) => {
        if (entries.length > 1) {
          // Check if times actually overlap
          const overlapping = this.checkTimeOverlap(entries);
          if (overlapping.length > 1) {
            conflicts.push({
              type: 'schedule',
              severity: 'error',
              description: `Conflicto de horario el ${this.getDayName(entries[0].day)} de ${entries[0].beginTime} a ${entries[0].endTime}`,
              items: overlapping.map(e => e.item),
              suggestions: [
                'Selecciona una sección diferente para una de las materias',
                'Cambia una de las materias a candidata para generar horarios alternativos'
              ]
            });
          }
        }
      });

      // Check for closed sections in priority items
      this.priorityItems.forEach(item => {
        const sections = item.type === 'subject' ? item.item.sections : [item.item];
        const closedSections = sections.filter(s => !s.openSection);
        
        if (closedSections.length > 0 && item.type === 'section') {
          conflicts.push({
            type: 'capacity',
            severity: 'warning',
            description: `La sección ${item.item.courseReferenceNumber} está cerrada`,
            items: [item],
            suggestions: [
              'Considera cambiar a una sección abierta',
              'Cambia a candidata si tienes alternativas'
            ]
          });
        }
      });

      return conflicts;
    },

    checkTimeOverlap(entries) {
      // Simple time overlap check - can be enhanced
      return entries;
    },

    getDayName(day) {
      const dayNames = {
        monday: 'Lunes',
        tuesday: 'Martes', 
        wednesday: 'Miércoles',
        thursday: 'Jueves',
        friday: 'Viernes',
        saturday: 'Sábado',
        sunday: 'Domingo'
      };
      return dayNames[day] || day;
    },

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

    formatSectionProfessor(section) {
      if (!section.meetingsFaculty || section.meetingsFaculty.length === 0) {
        return 'Sin profesor asignado';
      }
      
      const professors = section.meetingsFaculty
        .map(meeting => {
          if (meeting.faculty && meeting.faculty.displayName) {
            return meeting.faculty.displayName;
          }
          return null;
        })
        .filter(prof => prof)
        .filter((prof, index, arr) => arr.indexOf(prof) === index); // Remove duplicates
      
      if (professors.length === 0) {
        return 'Sin profesor asignado';
      }
      
      return professors.join(', ');
    },

    formatSubjectSections(subject) {
      const totalSections = subject.sections.length;
      const openSections = subject.sections.filter(section => section.openSection).length;
      
      const nrcs = subject.sections.slice(0, 2)
        .map(section => section.courseReferenceNumber)
        .filter(Boolean)
        .join(", ");
      
      return `${openSections} de ${totalSections} secciones abiertas${nrcs ? ` (NRCs: ${nrcs}${subject.sections.length > 2 ? '...' : ''})` : ''}`;
    },

    // Event handlers
    toggleSelectionType(item) {
      this.$emit('toggle-selection-type', item);
    },

    removeItem(item) {
      this.$emit('remove-item', item);
    },

    generateSchedules() {
      this.$emit('generate-schedules');
    },

    // Bulk operations
    selectAllPriority() {
      this.$emit('bulk-change-type', this.candidateItems, 'priority');
    },

    selectAllCandidate() {
      this.$emit('bulk-change-type', this.priorityItems, 'candidate');
    },

    clearAllSelections() {
      this.$emit('clear-all');
    }
  },

  template: `
    <div class="selection-panel">
      <!-- Panel Header with Summary -->
      <div class="selection-panel__header">
        <div class="selection-panel__title">
          <h2 class="m-0">📋 Elementos Seleccionados</h2>
          <div class="selection-panel__summary-badges">
            <span class="summary-badge total">{{ selectionStats.totalItems }} total</span>
            <span class="summary-badge priority">{{ priorityItems.length }} prioritarios</span>
            <span class="summary-badge candidate">{{ candidateItems.length }} candidatos</span>
          </div>
        </div>
        
        <!-- Conflict Indicator -->
        <div v-if="hasConflicts" class="conflict-indicator" :class="conflictSeverity">
          <i class="fas fa-exclamation-triangle"></i>
          <span>{{ selectionStats.conflicts.length }} conflicto{{ selectionStats.conflicts.length > 1 ? 's' : '' }}</span>
        </div>
      </div>

      <!-- Statistics Summary -->
      <div class="selection-panel__stats">
        <div class="stats-grid">
          <div class="stat-card credits">
            <div class="stat-icon">🎓</div>
            <div class="stat-content">
              <div class="stat-value">{{ selectionStats.totalCredits }}</div>
              <div class="stat-label">Créditos Totales</div>
              <div class="stat-breakdown">
                <span class="priority-credits">{{ selectionStats.priorityCredits }} prioritarios</span>
                <span class="candidate-credits">{{ selectionStats.candidateCredits }} candidatos</span>
              </div>
            </div>
          </div>

          <div class="stat-card distribution">
            <div class="stat-icon">📅</div>
            <div class="stat-content">
              <div class="stat-value">{{ Object.values(selectionStats.dayDistribution).reduce((a, b) => a + b, 0) }}</div>
              <div class="stat-label">Clases por Semana</div>
              <div class="day-distribution">
                <span v-for="(count, day) in selectionStats.dayDistribution" :key="day" 
                      class="day-count" :class="{ active: count > 0 }">
                  {{ day.charAt(0).toUpperCase() }}: {{ count }}
                </span>
              </div>
            </div>
          </div>

          <div class="stat-card sections">
            <div class="stat-icon">📊</div>
            <div class="stat-content">
              <div class="stat-value">{{ selectionStats.openSections + selectionStats.closedSections }}</div>
              <div class="stat-label">Secciones</div>
              <div class="section-breakdown">
                <span class="open-sections">{{ selectionStats.openSections }} abiertas</span>
                <span class="closed-sections">{{ selectionStats.closedSections }} cerradas</span>
              </div>
            </div>
          </div>

          <div class="stat-card conflicts" :class="{ 'has-conflicts': hasConflicts }">
            <div class="stat-icon">⚠️</div>
            <div class="stat-content">
              <div class="stat-value">{{ selectionStats.conflicts.length }}</div>
              <div class="stat-label">Conflictos</div>
              <div class="conflict-types">
                <span v-if="!hasConflicts" class="no-conflicts">Sin conflictos</span>
                <span v-else class="has-conflicts-text">Requiere atención</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Conflicts Section -->
      <div v-if="hasConflicts" class="conflicts-section">
        <div class="conflicts-header">
          <h3>⚠️ Conflictos Detectados</h3>
          <span class="conflicts-count">{{ selectionStats.conflicts.length }}</span>
        </div>
        
        <div class="conflicts-list">
          <div v-for="conflict in selectionStats.conflicts" :key="conflict.description" 
               class="conflict-item" :class="conflict.severity">
            <div class="conflict-icon">
              <i v-if="conflict.severity === 'error'" class="fas fa-times-circle"></i>
              <i v-else class="fas fa-exclamation-triangle"></i>
            </div>
            <div class="conflict-content">
              <div class="conflict-description">{{ conflict.description }}</div>
              <div class="conflict-suggestions">
                <strong>Sugerencias:</strong>
                <ul>
                  <li v-for="suggestion in conflict.suggestions" :key="suggestion">{{ suggestion }}</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Selection Content -->
      <div class="selection-panel__content">
        <!-- Empty State -->
        <div v-if="selectedItems.length === 0" class="empty-state">
          <div class="empty-state-icon">📝</div>
          <h5>No has seleccionado ningún elemento</h5>
          <p class="text-muted">Haz clic en las materias o expande para seleccionar secciones específicas</p>
        </div>

        <!-- Bulk Actions -->
        <div v-if="selectedItems.length > 0" class="bulk-actions">
          <div class="bulk-actions__title">Acciones en Lote:</div>
          <div class="bulk-actions__buttons">
            <button @click="selectAllPriority" class="bulk-btn priority" 
                    :disabled="candidateItems.length === 0">
              🔴 Todos Prioritarios
            </button>
            <button @click="selectAllCandidate" class="bulk-btn candidate"
                    :disabled="priorityItems.length === 0">
              🟡 Todos Candidatos
            </button>
            <button @click="clearAllSelections" class="bulk-btn danger">
              🗑️ Limpiar Todo
            </button>
          </div>
        </div>

        <!-- Priority Items Section -->
        <div v-if="priorityItems.length > 0" class="selection-section priority-section">
          <div class="section-header">
            <div class="section-title">
              <span class="section-badge priority">🔴 Elementos Prioritarios</span>
              <span class="section-count">{{ priorityItems.length }}</span>
            </div>
            <div class="section-description">
              Elementos que deben estar en todos los horarios generados
            </div>
          </div>

          <!-- Priority Subjects -->
          <div v-if="prioritySubjects.length > 0" class="subsection">
            <div class="subsection-title">📚 Materias Completas ({{ prioritySubjects.length }})</div>
            <div class="items-grid">
              <div v-for="item in prioritySubjects" :key="'ps-' + item.item.id" 
                   class="selection-item priority">
                <div class="item-header">
                  <div class="item-code">{{ item.item.subject }}{{ item.item.courseNumber }}</div>
                  <div class="item-actions">
                    <button @click="toggleSelectionType(item)" 
                            class="action-btn change-type" title="Cambiar a candidata">
                      🔄
                    </button>
                    <button @click="removeItem(item)" 
                            class="action-btn remove" title="Eliminar">
                      🗑️
                    </button>
                  </div>
                </div>
                <div class="item-title">{{ item.item.courseTitle }}</div>
                <div class="item-details">
                  <span class="credits">🎓 {{ item.item.creditHourLow || 0 }} créditos</span>
                  <span class="sections-info">📊 {{ formatSubjectSections(item.item) }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Priority Sections -->
          <div v-if="prioritySections.length > 0" class="subsection">
            <div class="subsection-title">📋 Secciones Específicas ({{ prioritySections.length }})</div>
            <div class="items-grid">
              <div v-for="item in prioritySections" :key="'pse-' + item.item.id" 
                   class="selection-item priority section-item">
                <div class="item-header">
                  <div class="item-code">{{ item.subjectInfo.subject }}{{ item.subjectInfo.courseNumber }}</div>
                  <div class="item-actions">
                    <button @click="toggleSelectionType(item)" 
                            class="action-btn change-type" title="Cambiar a candidata">
                      🔄
                    </button>
                    <button @click="removeItem(item)" 
                            class="action-btn remove" title="Eliminar">
                      🗑️
                    </button>
                  </div>
                </div>
                <div class="item-title">{{ item.subjectInfo.courseTitle }}</div>
                <div class="section-details">
                  <div class="section-info">
                    <span class="nrc">{{ item.item.courseReferenceNumber }}</span>
                    <span class="sequence">Sec. {{ item.item.sequenceNumber }}</span>
                    <span class="status" :class="item.item.openSection ? 'open' : 'closed'">
                      {{ item.item.openSection ? '✅ Abierta' : '❌ Cerrada' }}
                    </span>
                  </div>
                  <div class="schedule">⏰ {{ formatSectionSchedule(item.item) }}</div>
                  <div class="professor">👨‍🏫 {{ formatSectionProfessor(item.item) }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Candidate Items Section -->
        <div v-if="candidateItems.length > 0" class="selection-section candidate-section">
          <div class="section-header">
            <div class="section-title">
              <span class="section-badge candidate">🟡 Elementos Candidatos</span>
              <span class="section-count">{{ candidateItems.length }}</span>
            </div>
            <div class="section-description">
              Elementos opcionales que se incluirán si no generan conflictos
            </div>
          </div>

          <!-- Candidate Subjects -->
          <div v-if="candidateSubjects.length > 0" class="subsection">
            <div class="subsection-title">📚 Materias Completas ({{ candidateSubjects.length }})</div>
            <div class="items-grid">
              <div v-for="item in candidateSubjects" :key="'cs-' + item.item.id" 
                   class="selection-item candidate">
                <div class="item-header">
                  <div class="item-code">{{ item.item.subject }}{{ item.item.courseNumber }}</div>
                  <div class="item-actions">
                    <button @click="toggleSelectionType(item)" 
                            class="action-btn change-type" title="Cambiar a prioritaria">
                      🔄
                    </button>
                    <button @click="removeItem(item)" 
                            class="action-btn remove" title="Eliminar">
                      🗑️
                    </button>
                  </div>
                </div>
                <div class="item-title">{{ item.item.courseTitle }}</div>
                <div class="item-details">
                  <span class="credits">🎓 {{ item.item.creditHourLow || 0 }} créditos</span>
                  <span class="sections-info">📊 {{ formatSubjectSections(item.item) }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Candidate Sections -->
          <div v-if="candidateSections.length > 0" class="subsection">
            <div class="subsection-title">📋 Secciones Específicas ({{ candidateSections.length }})</div>
            <div class="items-grid">
              <div v-for="item in candidateSections" :key="'cse-' + item.item.id" 
                   class="selection-item candidate section-item">
                <div class="item-header">
                  <div class="item-code">{{ item.subjectInfo.subject }}{{ item.subjectInfo.courseNumber }}</div>
                  <div class="item-actions">
                    <button @click="toggleSelectionType(item)" 
                            class="action-btn change-type" title="Cambiar a prioritaria">
                      🔄
                    </button>
                    <button @click="removeItem(item)" 
                            class="action-btn remove" title="Eliminar">
                      🗑️
                    </button>
                  </div>
                </div>
                <div class="item-title">{{ item.subjectInfo.courseTitle }}</div>
                <div class="section-details">
                  <div class="section-info">
                    <span class="nrc">{{ item.item.courseReferenceNumber }}</span>
                    <span class="sequence">Sec. {{ item.item.sequenceNumber }}</span>
                    <span class="status" :class="item.item.openSection ? 'open' : 'closed'">
                      {{ item.item.openSection ? '✅ Abierta' : '❌ Cerrada' }}
                    </span>
                  </div>
                  <div class="schedule">⏰ {{ formatSectionSchedule(item.item) }}</div>
                  <div class="professor">👨‍🏫 {{ formatSectionProfessor(item.item) }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Enhanced Generation Controls -->
        <div v-if="selectedItems.length > 0" class="generation-section">
          <div class="generation-header">
            <h3>🚀 Generar Horarios</h3>
            <p>Configura las opciones y genera tus horarios personalizados</p>
          </div>
          
          <div class="generation-content">
            <div class="generation-options-grid">
              <div class="option-card">
                <div class="option-header">
                  <i class="fas fa-filter"></i>
                  <span>Filtros de Secciones</span>
                </div>
                <div class="option-content">
                  <label class="custom-checkbox">
                    <input type="checkbox" :checked="onlyOpenSections" 
                           @change="$emit('update:onlyOpenSections', $event.target.checked)">
                    <span class="checkmark"></span>
                    <span class="checkbox-label">
                      <strong>Solo secciones abiertas</strong>
                      <small>Excluir secciones cerradas del horario</small>
                    </span>
                  </label>
                </div>
              </div>
              
              <div class="option-card">
                <div class="option-header">
                  <i class="fas fa-map-marker-alt"></i>
                  <span>Sede Preferida</span>
                </div>
                <div class="option-content">
                  <div class="campus-selector-enhanced">
                    <select :value="selectedCampus" 
                            @change="$emit('update:selectedCampus', $event.target.value)" 
                            class="campus-select">
                      <option value="">🏫 Todas las sedes</option>
                      <option v-for="campus in campuses" :key="campus" :value="campus">
                        🏢 {{ campus }}
                      </option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Generation Summary -->
            <div class="generation-summary">
              <div class="summary-stats">
                <div class="summary-item">
                  <span class="summary-value">{{ selectedItems.length }}</span>
                  <span class="summary-label">elementos</span>
                </div>
                <div class="summary-item">
                  <span class="summary-value">{{ selectionStats.totalCredits }}</span>
                  <span class="summary-label">créditos</span>
                </div>
                <div class="summary-item" :class="{ 'has-conflicts': hasConflicts }">
                  <span class="summary-value">{{ selectionStats.conflicts.length }}</span>
                  <span class="summary-label">conflictos</span>
                </div>
              </div>
              
              <div class="generation-actions">
                <button @click="generateSchedules" 
                        class="generate-btn-enhanced" 
                        :disabled="selectedItems.length === 0 || generatingSchedules"
                        :class="{ 
                          'generating': generatingSchedules, 
                          'has-conflicts': hasConflicts,
                          'ready': !hasConflicts && selectedItems.length > 0
                        }">
                  <div class="btn-content">
                    <div class="btn-icon">
                      <i v-if="generatingSchedules" class="fas fa-spinner fa-spin"></i>
                      <i v-else-if="hasConflicts" class="fas fa-exclamation-triangle"></i>
                      <i v-else class="fas fa-rocket"></i>
                    </div>
                    <div class="btn-text">
                      <span class="btn-title">
                        {{ generatingSchedules ? 'Generando...' : 'Generar Horarios' }}
                      </span>
                      <span class="btn-subtitle">
                        {{ generatingSchedules ? 'Por favor espera' : 
                           hasConflicts ? 'Con conflictos detectados' : 
                           'Crear horarios optimizados' }}
                      </span>
                    </div>
                  </div>
                  
                  <div v-if="generatingSchedules" class="progress-bar">
                    <div class="progress-fill"></div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
};