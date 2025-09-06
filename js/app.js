import { createApp } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import CourseList from './components/CourseList.js';
import SubjectSelector from './components/SubjectSelector.js';
import SectionSelector from './components/SectionSelector.js';
import SelectionPanel from './components/SelectionPanel.js';
import ScheduleResults from './components/ScheduleResults.js';

const app = createApp({
  components: {
    CourseList,
    SubjectSelector,
    SectionSelector,
    SelectionPanel,
    ScheduleResults
  },
  
  data() {
    return {
      currentView: 'hybrid-selector', // Default to hybrid mode
      generatedSchedules: null,
      showAdvancedOptions: false
    };
  },
  
  methods: {
    handleSchedulesGenerated(schedules) {
      this.generatedSchedules = schedules;
    },
    
    toggleAdvancedOptions() {
      this.showAdvancedOptions = !this.showAdvancedOptions;
    }
  },
  
  template: `
    <div class="app-container">
      <header class="app-header">
        <div class="header-content">
          <div class="header-main">
            <h1 class="app-title">📚 Planificador de Horarios UCAB</h1>
            <p class="app-subtitle">Selecciona materias y secciones para generar tu horario ideal</p>
          </div>
          <div class="header-status">
            <span class="status-badge integrated" title="Datos integrados desde HTML y JSON">
              <i class="fas fa-database"></i> Datos Integrados
            </span>
          </div>
        </div>
      </header>
      
      <div class="app-main">
        <!-- Main Hybrid Selector -->
        <div class="main-content">
          <div class="content-grid">
            <div class="selector-column">
              <section-selector @schedules-generated="handleSchedulesGenerated" />
            </div>
            <div class="results-column">
              <schedule-results 
                :generated-schedules="generatedSchedules"
              />
            </div>
          </div>
        </div>
        
        <!-- Advanced Options (Collapsible) -->
        <div class="advanced-options" v-if="showAdvancedOptions">
          <div class="advanced-header">
            <h3>🔧 Opciones Avanzadas</h3>
            <button @click="toggleAdvancedOptions" class="btn-close-advanced">
              <i class="fas fa-times"></i>
            </button>
          </div>
          
          <div class="advanced-content">
            <div class="advanced-tabs">
              <button 
                @click="currentView = 'subject-selector'" 
                :class="['advanced-tab', currentView === 'subject-selector' ? 'active' : '']"
              >
                <i class="fas fa-book"></i>
                Selección por Materias
              </button>
              <button 
                @click="currentView = 'course-list'" 
                :class="['advanced-tab', currentView === 'course-list' ? 'active' : '']"
              >
                <i class="fas fa-list"></i>
                Lista de Cursos
              </button>
            </div>
            
            <div class="advanced-view">
              <div v-if="currentView === 'subject-selector'" class="legacy-view">
                <div class="legacy-grid">
                  <div class="legacy-selector">
                    <subject-selector @schedules-generated="handleSchedulesGenerated" />
                  </div>
                  <div class="legacy-results">
                    <schedule-results 
                      :generated-schedules="generatedSchedules"
                    />
                  </div>
                </div>
              </div>
              
              <div v-else-if="currentView === 'course-list'" class="legacy-view">
                <course-list></course-list>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Toggle Advanced Options Button -->
        <div class="advanced-toggle" v-if="!showAdvancedOptions">
          <button @click="toggleAdvancedOptions" class="btn-advanced-toggle">
            <i class="fas fa-cog"></i>
            Opciones Avanzadas
          </button>
        </div>
      </div>
    </div>
  `
});

app.mount('#app');
