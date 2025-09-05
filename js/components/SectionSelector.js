import CourseService from '../services/CourseService.js';
import ScheduleGeneratorService from '../services/ScheduleGeneratorService.js';
import SubjectCard from './SubjectCard.js';
import FilterPanel from './FilterPanel.js';
import AnimationService from '../services/AnimationService.js';

export default {
  components: {
    SubjectCard,
    FilterPanel
  },
  
  data() {
    return {
      courses: [],
      subjects: [],
      filteredSubjects: [],
      selectedItems: [], // Array de objetos { type: 'subject'|'section', item, selectionType, subjectInfo? }
      selectionMode: 'priority', // Puede ser 'priority' o 'candidate'
      selectionType: 'subject', // Puede ser 'subject' o 'section'
      loading: true,
      error: null,
      filters: {
        subject: '',
        courseNumber: '',
        search: '',
        campus: ''
      },
      subjectCodes: [],
      campuses: [],
      onlyOpenSections: true,
      generatingSchedules: false,
      generatedSchedules: null,
      selectedCampus: '',
      expandedSubjects: new Set() // Para controlar qué materias están expandidas
    };
  },
  
  async mounted() {
    try {
      this.loading = true;
      
      // Initialize animation service
      AnimationService.init();
      
      this.courses = await CourseService.loadCourses();
      this.subjects = ScheduleGeneratorService.groupCoursesBySubject(this.courses);
      this.filteredSubjects = [...this.subjects];
      this.initializeFilters();
      
      // Animate initial load
      this.$nextTick(() => {
        const subjectCards = document.querySelectorAll('.subject-card');
        subjectCards.forEach((card, index) => {
          setTimeout(() => {
            card.classList.add('animate-fade-in');
          }, index * 50);
        });
      });
      
    } catch (error) {
      this.error = `Error al cargar los cursos: ${error.message}`;
      console.error(error);
    } finally {
      this.loading = false;
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
    }
  },
  
  methods: {
    // FilterPanel event handlers
    onFiltersApplied(data) {
      this.filteredSubjects = data.filteredSubjects;
      
      // Emit event for parent components if needed
      this.$emit('subjects-filtered', {
        filteredSubjects: data.filteredSubjects,
        filters: data.filters,
        stats: data.stats
      });
    },
    
    onPresetSaved(preset) {
      // Handle preset saved event
      console.log('Preset guardado:', preset.name);
    },
    
    onPresetLoaded(preset) {
      // Handle preset loaded event
      console.log('Preset cargado:', preset.name);
    },
    
    onPresetDeleted(presetId) {
      // Handle preset deleted event
      console.log('Preset eliminado:', presetId);
    },
    
    normalizeText(text) {
      if (!text) return '';
      return text.normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
    },
    
    initializeFilters() {
      this.subjectCodes = [...new Set(this.subjects.map(subject => subject.subject))].sort();
      
      const allCampuses = new Set();
      this.courses.forEach(course => {
        if (course.campusDescription && course.campusDescription.trim()) {
          allCampuses.add(course.campusDescription);
        }
      });
      this.campuses = [...allCampuses].sort();
    },
    

    
    async toggleSubjectExpansion(subjectId) {
      const isExpanded = this.expandedSubjects.has(subjectId);
      
      if (isExpanded) {
        // Animate collapse
        const sectionsContainer = document.querySelector(`[data-subject-id="${subjectId}"] .subject-card__sections`);
        if (sectionsContainer) {
          sectionsContainer.classList.add('subject-card__sections--collapsing');
          await AnimationService.expandCollapse(sectionsContainer, false);
          sectionsContainer.classList.remove('subject-card__sections--collapsing');
        }
        this.expandedSubjects.delete(subjectId);
      } else {
        // Animate expand
        this.expandedSubjects.add(subjectId);
        this.$nextTick(async () => {
          const sectionsContainer = document.querySelector(`[data-subject-id="${subjectId}"] .subject-card__sections`);
          if (sectionsContainer) {
            sectionsContainer.classList.add('subject-card__sections--expanding');
            await AnimationService.expandCollapse(sectionsContainer, true);
            sectionsContainer.classList.remove('subject-card__sections--expanding');
          }
        });
      }
    },
    
    isSubjectExpanded(subjectId) {
      return this.expandedSubjects.has(subjectId);
    },
    
    // Método para seleccionar una materia completa
    async toggleSubjectSelection(subject) {
      const subjectId = subject.id;
      const index = this.selectedItems.findIndex(item => 
        item.type === 'subject' && item.item.id === subjectId
      );
      
      // Find the subject card element for animation
      const subjectCard = document.querySelector(`[data-subject-id="${subjectId}"]`);
      
      if (index === -1) {
        // Add selection with animation
        this.selectedItems.push({
          type: 'subject',
          item: subject,
          selectionType: this.selectionMode
        });
        
        if (subjectCard) {
          subjectCard.classList.add('subject-card--state-changing');
          await AnimationService.bounce(subjectCard, { scale: 1.02 });
          subjectCard.classList.remove('subject-card--state-changing');
        }
      } else {
        // Remove selection with animation
        if (subjectCard) {
          subjectCard.classList.add('subject-card--state-changing');
          await AnimationService.fade(subjectCard, false, { duration: 200 });
          await AnimationService.fade(subjectCard, true, { duration: 200 });
          subjectCard.classList.remove('subject-card--state-changing');
        }
        this.selectedItems.splice(index, 1);
      }
    },
    
    // Método para seleccionar una sección específica
    async toggleSectionSelection(section, subject) {
      const sectionId = section.id;
      const index = this.selectedItems.findIndex(item => 
        item.type === 'section' && item.item.id === sectionId
      );
      
      // Find the section card element for animation
      const sectionCard = document.querySelector(`[data-section-id="${sectionId}"]`);
      
      if (index === -1) {
        // Add selection with animation
        this.selectedItems.push({
          type: 'section',
          item: section,
          selectionType: this.selectionMode,
          subjectInfo: {
            id: subject.id,
            subject: subject.subject,
            courseNumber: subject.courseNumber,
            courseTitle: subject.courseTitle,
            creditHourLow: subject.creditHourLow
          }
        });
        
        if (sectionCard) {
          await AnimationService.slide(sectionCard, 'right', true, { distance: 20 });
        }
      } else {
        // Remove selection with animation
        if (sectionCard) {
          await AnimationService.slide(sectionCard, 'left', false, { distance: 20 });
        }
        this.selectedItems.splice(index, 1);
      }
    },
    
    async toggleSelectionType(index) {
      if (index >= 0 && index < this.selectedItems.length) {
        const item = this.selectedItems[index];
        const currentType = item.selectionType;
        
        // Find the corresponding card element
        const cardSelector = item.type === 'subject' 
          ? `[data-subject-id="${item.item.id}"]`
          : `[data-section-id="${item.item.id}"]`;
        const cardElement = document.querySelector(cardSelector);
        
        // Animate state change
        if (cardElement) {
          cardElement.classList.add('subject-card--state-changing');
          await AnimationService.stateTransition(cardElement, 
            `selected-${currentType}`, 
            `selected-${currentType === 'priority' ? 'candidate' : 'priority'}`
          );
          cardElement.classList.remove('subject-card--state-changing');
        }
        
        this.selectedItems[index].selectionType = currentType === 'priority' ? 'candidate' : 'priority';
      }
    },
    
    isSubjectSelected(subjectId) {
      return this.selectedItems.some(item => 
        item.type === 'subject' && item.item.id === subjectId
      );
    },
    
    isSectionSelected(sectionId) {
      return this.selectedItems.some(item => 
        item.type === 'section' && item.item.id === sectionId
      );
    },
    
    getSelectionType(itemId, type) {
      const item = this.selectedItems.find(item => 
        item.type === type && item.item.id === itemId
      );
      return item ? item.selectionType : null;
    },
    

    
    countOpenSections(subject) {
      return subject.sections.filter(section => section.openSection).length;
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
    
    async generateSchedules() {
      this.generatingSchedules = true;
      
      // Show loading indicator
      const generateButton = document.querySelector('.btn-primary[data-action="generate"]');
      let loadingIndicator = null;
      
      if (generateButton) {
        loadingIndicator = AnimationService.createLoadingIndicator(generateButton.parentElement, {
          type: 'spinner',
          text: 'Generando horarios',
          size: 'small'
        });
      }
      
      try {
        // Add a small delay to show the loading animation
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Procesar materias completas seleccionadas
        const prioritySubjects = this.prioritySubjects.map(item => item.item);
        const candidateSubjects = this.candidateSubjects.map(item => item.item);
        
        // Procesar secciones específicas seleccionadas
        const prioritySections = this.prioritySections;
        const candidateSections = this.candidateSections;
        
        // Agrupar secciones específicas por materia
        const groupedPrioritySections = this.groupSectionsBySubject(prioritySections);
        const groupedCandidateSections = this.groupSectionsBySubject(candidateSections);
        
        // Combinar materias completas con secciones específicas
        const finalPrioritySubjects = this.combineSubjectsAndSections(prioritySubjects, groupedPrioritySections);
        const finalCandidateSubjects = this.combineSubjectsAndSections(candidateSubjects, groupedCandidateSections);
        
        this.generatedSchedules = ScheduleGeneratorService.generatePossibleSchedulesWithCandidates(
          finalPrioritySubjects,
          finalCandidateSubjects,
          this.onlyOpenSections,
          this.selectedCampus
        );
        
        this.$emit('schedules-generated', this.generatedSchedules);
        
        // Animate success
        if (generateButton) {
          await AnimationService.bounce(generateButton, { scale: 1.05 });
        }
        
      } catch (error) {
        console.error('Error generando horarios:', error);
        this.error = `Error al generar horarios: ${error.message}`;
        
        // Animate error
        if (generateButton) {
          generateButton.classList.add('btn-danger');
          await AnimationService.pulse(generateButton, { opacity: 0.7 });
          setTimeout(() => {
            generateButton.classList.remove('btn-danger');
          }, 2000);
        }
      } finally {
        this.generatingSchedules = false;
        
        // Remove loading indicator
        if (loadingIndicator) {
          loadingIndicator.remove();
        }
      }
    },
    
    groupSectionsBySubject(sections) {
      const grouped = {};
      sections.forEach(item => {
        const subjectKey = `${item.subjectInfo.subject}${item.subjectInfo.courseNumber}`;
        if (!grouped[subjectKey]) {
          grouped[subjectKey] = {
            id: subjectKey,
            subject: item.subjectInfo.subject,
            courseNumber: item.subjectInfo.courseNumber,
            courseTitle: item.subjectInfo.courseTitle,
            creditHourLow: item.subjectInfo.creditHourLow,
            sections: []
          };
        }
        grouped[subjectKey].sections.push(item.item);
      });
      return Object.values(grouped);
    },
    
    combineSubjectsAndSections(subjects, groupedSections) {
      const result = [...subjects];
      
      // Agregar materias que solo tienen secciones específicas
      groupedSections.forEach(sectionSubject => {
        const existingSubject = result.find(subject => subject.id === sectionSubject.id);
        if (existingSubject) {
          // Si ya existe la materia, reemplazar sus secciones con las específicas seleccionadas
          existingSubject.sections = sectionSubject.sections;
        } else {
          // Si no existe, agregar la materia con sus secciones específicas
          result.push(sectionSubject);
        }
      });
      
      return result;
    },
    
    formatSubjectSections(subject) {
      const totalSections = subject.sections.length;
      const openSections = this.countOpenSections(subject);
      
      const nrcs = subject.sections.slice(0, 2)
        .map(section => section.courseReferenceNumber)
        .filter(Boolean)
        .join(", ");
      
      return `${openSections} de ${totalSections} secciones abiertas${nrcs ? ` (NRCs: ${nrcs}${subject.sections.length > 2 ? '...' : ''})` : ''}`;
    }
  },
  
  template: `
    <div class="hybrid-selector-container">
      <div v-if="loading" class="loading-overlay">
        <div class="loading-content">
          <div class="loading-spinner spinner-border text-primary" role="status">
            <span class="visually-hidden">Cargando...</span>
          </div>
          <div class="loading-text">
            Cargando materias
            <span class="loading-dots">
              <span class="loading-dot"></span>
              <span class="loading-dot"></span>
              <span class="loading-dot"></span>
            </span>
          </div>
        </div>
      </div>
      
      <div v-else-if="error" class="alert alert-danger">
        {{ error }}
      </div>
      
      <div v-else>
        <div class="card mb-4">
          <div class="hybrid-selector-header card-header d-flex justify-content-between align-items-center">
            <h2 class="m-0">Selección Híbrida de Materias y Secciones</h2>
            <div class="selection-mode-toggle">
              <div class="btn-group btn-group-sm me-3" role="group">
                <button 
                  @click="selectionType = 'subject'" 
                  :class="['mode-toggle-btn', selectionType === 'subject' ? 'active' : '']"
                >
                  📚 Materias Completas
                </button>
                <button 
                  @click="selectionType = 'section'" 
                  :class="['mode-toggle-btn', selectionType === 'section' ? 'active' : '']"
                >
                  📋 Secciones Específicas
                </button>
              </div>
              <div class="btn-group btn-group-sm" role="group">
                <button 
                  @click="selectionMode = 'priority'" 
                  :class="['mode-toggle-btn', selectionMode === 'priority' ? 'active' : '']"
                >
                  🔴 Prioritaria
                </button>
                <button 
                  @click="selectionMode = 'candidate'" 
                  :class="['mode-toggle-btn', selectionMode === 'candidate' ? 'active' : '']"
                >
                  🟡 Candidata
                </button>
              </div>
              <span class="badge bg-light text-dark ms-2">{{ filteredSubjects.length }} materias</span>
            </div>
          </div>
          
          <div class="card-body">
            <!-- FilterPanel Component -->
            <FilterPanel
              :subjects="subjects"
              :courses="courses"
              :campuses="campuses"
              :subject-codes="subjectCodes"
              @filters-applied="onFiltersApplied"
              @preset-saved="onPresetSaved"
              @preset-loaded="onPresetLoaded"
              @preset-deleted="onPresetDeleted"
            />
            
            <!-- Selection mode and type indicators -->
            <div class="selection-mode-info p-3 mb-3 bg-light rounded">
              <div class="d-flex align-items-center gap-3 justify-content-center">
                <div class="d-flex align-items-center">
                  <span class="me-2 fw-semibold">Tipo:</span>
                  <span class="selection-badge" :class="selectionType === 'subject' ? 'bg-success text-white' : 'bg-info text-white'">
                    {{ selectionType === 'subject' ? '📚 Materias' : '📋 Secciones' }}
                  </span>
                </div>
                <div class="d-flex align-items-center">
                  <span class="me-2 fw-semibold">Modo:</span>
                  <span class="selection-badge" :class="selectionMode === 'priority' ? 'priority' : 'candidate'">
                    {{ selectionMode === 'priority' ? '🔴 Prioritaria' : '🟡 Candidata' }}
                  </span>
                </div>
              </div>
            </div>
            
            <div class="subject-list-container">
              <div v-if="filteredSubjects.length === 0" class="empty-state">
                <div class="empty-state-icon">📚</div>
                <h5>No se encontraron materias</h5>
                <p class="text-muted">Intenta ajustar los filtros para encontrar las materias que buscas.</p>
              </div>
              
              <SubjectCard
                v-for="subject in filteredSubjects" 
                :key="subject.id"
                :subject="subject"
                :is-selected="isSubjectSelected(subject.id)"
                :selection-type="getSelectionType(subject.id, 'subject')"
                :is-expanded="isSubjectExpanded(subject.id)"
                :selection-mode="selectionType"
                :only-open-sections="onlyOpenSections"
                :selected-sections="selectedItems"
                :data-subject-id="subject.id"
                @toggle-selection="toggleSubjectSelection"
                @toggle-expansion="toggleSubjectExpansion"
                @section-selection="toggleSectionSelection"
              />
            </div>
          </div>
        </div>
        
        <div class="selected-items-panel card">
          <div class="selected-items-header card-header">
            <h2 class="m-0">📋 Elementos Seleccionados</h2>
          </div>
          
          <div class="card-body">
            <div v-if="selectedItems.length === 0" class="empty-state">
              <div class="empty-state-icon">📝</div>
              <h5>No has seleccionado ningún elemento</h5>
              <p class="text-muted">Haz clic en las materias o expande para seleccionar secciones específicas</p>
            </div>
            
            <div v-else>
              <!-- Sección de materias prioritarias -->
              <div v-if="prioritySubjects.length > 0">
                <div class="selected-section-header">
                  <span class="section-type-badge priority">🔴 Materias Prioritarias</span>
                  <span class="text-muted">Materias completas que deben estar en todos los horarios</span>
                </div>
                <div v-for="(item, index) in prioritySubjects" :key="'ps-'+item.item.id" 
                    class="selected-item-card priority p-3 mb-3">
                  <div class="d-flex justify-content-between align-items-center">
                    <div class="subject-content">
                      <div class="subject-code">{{ item.item.subject }}{{ item.item.courseNumber }}</div>
                      <div class="subject-title small mb-1">{{ item.item.courseTitle }}</div>
                      <div class="small text-muted">
                        🎓 {{ item.item.creditHourLow || 0 }} créditos · 
                        📊 {{ formatSubjectSections(item.item) }}
                      </div>
                    </div>
                    
                    <div class="d-flex gap-2">
                      <button @click.stop="toggleSelectionType(selectedItems.indexOf(item))" 
                          class="item-action-btn btn-outline-warning" title="Cambiar a candidata">
                        🔄 Candidata
                      </button>
                      <button @click.stop="toggleSubjectSelection(item.item)" 
                          class="item-action-btn btn-outline-danger" title="Eliminar">
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- Sección de secciones prioritarias -->
              <div v-if="prioritySections.length > 0" :class="{'mt-4': prioritySubjects.length > 0}">
                <div class="selected-section-header">
                  <span class="section-type-badge priority">🔴 Secciones Prioritarias</span>
                  <span class="text-muted">Secciones específicas que deben estar en todos los horarios</span>
                </div>
                <div v-for="(item, index) in prioritySections" :key="'ps-'+item.item.id" 
                    class="selected-item-card priority p-3 mb-3">
                  <div class="d-flex justify-content-between align-items-center">
                    <div class="subject-content">
                      <div class="subject-code">{{ item.subjectInfo.subject }}{{ item.subjectInfo.courseNumber }}</div>
                      <div class="subject-title small mb-1">{{ item.subjectInfo.courseTitle }}</div>
                      <div class="section-header mb-1">
                        <span class="section-nrc">{{ item.item.courseReferenceNumber }}</span>
                        <span class="section-sequence">Sec. {{ item.item.sequenceNumber }}</span>
                        <span class="section-status-badge" :class="item.item.openSection ? 'open' : 'closed'">
                          {{ item.item.openSection ? '✅ Abierta' : '❌ Cerrada' }}
                        </span>
                      </div>
                      <div class="section-schedule small">⏰ {{ formatSectionSchedule(item.item) }}</div>
                    </div>
                    
                    <div class="d-flex gap-2">
                      <button @click.stop="toggleSelectionType(selectedItems.indexOf(item))" 
                          class="item-action-btn btn-outline-warning" title="Cambiar a candidata">
                        🔄 Candidata
                      </button>
                      <button @click.stop="toggleSectionSelection(item.item, item.subjectInfo)" 
                          class="item-action-btn btn-outline-danger" title="Eliminar">
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- Sección de materias candidatas -->
              <div v-if="candidateSubjects.length > 0" :class="{'mt-4': prioritySubjects.length > 0 || prioritySections.length > 0}">
                <div class="selected-section-header">
                  <span class="section-type-badge candidate">🟡 Materias Candidatas</span>
                  <span class="text-muted">Materias completas opcionales que pueden incluirse si no generan conflictos</span>
                </div>
                <div v-for="(item, index) in candidateSubjects" :key="'cs-'+item.item.id"
                    class="selected-item-card candidate p-3 mb-3">
                  <div class="d-flex justify-content-between align-items-center">
                    <div class="subject-content">
                      <div class="subject-code">{{ item.item.subject }}{{ item.item.courseNumber }}</div>
                      <div class="subject-title small mb-1">{{ item.item.courseTitle }}</div>
                      <div class="small text-muted">
                        🎓 {{ item.item.creditHourLow || 0 }} créditos · 
                        📊 {{ formatSubjectSections(item.item) }}
                      </div>
                    </div>
                    
                    <div class="d-flex gap-2">
                      <button @click.stop="toggleSelectionType(selectedItems.indexOf(item))" 
                          class="item-action-btn btn-outline-danger" title="Cambiar a prioritaria">
                        🔄 Prioritaria
                      </button>
                      <button @click.stop="toggleSubjectSelection(item.item)" 
                          class="item-action-btn btn-outline-danger" title="Eliminar">
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- Sección de secciones candidatas -->
              <div v-if="candidateSections.length > 0" :class="{'mt-4': prioritySubjects.length > 0 || prioritySections.length > 0 || candidateSubjects.length > 0}">
                <div class="selected-section-header">
                  <span class="section-type-badge candidate">🟡 Secciones Candidatas</span>
                  <span class="text-muted">Secciones específicas opcionales que pueden incluirse si no generan conflictos</span>
                </div>
                <div v-for="(item, index) in candidateSections" :key="'cs-'+item.item.id"
                    class="selected-item-card candidate p-3 mb-3">
                  <div class="d-flex justify-content-between align-items-center">
                    <div class="subject-content">
                      <div class="subject-code">{{ item.subjectInfo.subject }}{{ item.subjectInfo.courseNumber }}</div>
                      <div class="subject-title small mb-1">{{ item.subjectInfo.courseTitle }}</div>
                      <div class="section-header mb-1">
                        <span class="section-nrc">{{ item.item.courseReferenceNumber }}</span>
                        <span class="section-sequence">Sec. {{ item.item.sequenceNumber }}</span>
                        <span class="section-status-badge" :class="item.item.openSection ? 'open' : 'closed'">
                          {{ item.item.openSection ? '✅ Abierta' : '❌ Cerrada' }}
                        </span>
                      </div>
                      <div class="section-schedule small">⏰ {{ formatSectionSchedule(item.item) }}</div>
                    </div>
                    
                    <div class="d-flex gap-2">
                      <button @click.stop="toggleSelectionType(selectedItems.indexOf(item))" 
                          class="item-action-btn btn-outline-danger" title="Cambiar a prioritaria">
                        🔄 Prioritaria
                      </button>
                      <button @click.stop="toggleSectionSelection(item.item, item.subjectInfo)" 
                          class="item-action-btn btn-outline-danger" title="Eliminar">
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              
              <div class="d-flex justify-content-between align-items-center mt-4 p-3 border-top bg-light rounded">
                <div class="d-flex align-items-center gap-3">
                  <div class="text-center">
                    <div class="fw-bold text-primary fs-4">{{ selectedItems.length }}</div>
                    <div class="small text-muted">Total</div>
                  </div>
                  <div class="text-center">
                    <div class="fw-bold text-danger fs-5">{{ priorityItems.length }}</div>
                    <div class="small text-muted">🔴 Prioritarios</div>
                  </div>
                  <div class="text-center">
                    <div class="fw-bold text-warning fs-5">{{ candidateItems.length }}</div>
                    <div class="small text-muted">🟡 Candidatos</div>
                  </div>
                </div>
                <div class="text-end">
                  <div class="small text-muted">Elementos seleccionados</div>
                  <div class="fw-semibold">📊 Resumen de selección</div>
                </div>
              </div>
              
              <div class="d-flex justify-content-between mt-2 p-2 border-top">
                <div>
                  <strong>Desglose:</strong>
                </div>
                <div class="text-muted small">
                  <span class="me-3">{{ prioritySubjects.length }} materias prioritarias</span>
                  <span class="me-3">{{ prioritySections.length }} secciones prioritarias</span>
                  <span class="me-3">{{ candidateSubjects.length }} materias candidatas</span>
                  <span>{{ candidateSections.length }} secciones candidatas</span>
                </div>
              </div>
              
              <div class="mt-3">
                <div class="form-check mb-2">
                  <input class="form-check-input" type="checkbox" v-model="onlyOpenSections" id="onlyOpenSections">
                  <label class="form-check-label" for="onlyOpenSections">
                    Considerar solo secciones abiertas
                  </label>
                </div>
                
                <div class="mb-3">
                  <label class="form-label">Generar horarios para sede:</label>
                  <select v-model="selectedCampus" class="form-select">
                    <option value="">Todas las sedes</option>
                    <option v-for="campus in campuses" :key="campus" :value="campus">
                      {{ campus }}
                    </option>
                  </select>
                </div>
                
                <button 
                  @click="generateSchedules" 
                  class="btn btn-primary w-100"
                  :disabled="selectedItems.length === 0 || generatingSchedules"
                  data-action="generate"
                >
                  <span v-if="generatingSchedules" class="spinner-border spinner-border-sm me-2" role="status"></span>
                  <span v-if="!generatingSchedules">🚀 Generar horarios posibles</span>
                  <span v-else>
                    Generando
                    <span class="loading-dots">
                      <span class="loading-dot"></span>
                      <span class="loading-dot"></span>
                      <span class="loading-dot"></span>
                    </span>
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
};
